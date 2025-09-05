const { pool } = require('../config/database');
const { DEPOSIT_ROLLOVER_REQUIREMENT, VIP_DEPOSIT_THRESHOLD, UNLOCK_OFFERS } = require('../config/constants');

class UserService {
    async getUserProfile(userId) {
        try {
            const result = await pool.query(
                `SELECT 
                    id, username, email, phone, player_tier,
                    balance,
                    bonus_vault_balance,
                    withdrawable_balance
                 FROM users WHERE id = $1`,
                [userId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    async requestWithdrawal(userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
            const user = userResult.rows[0];

            if (!user) throw new Error('Usuário não encontrado');
            
            const calculatedWithdrawable = await this._calculateWithdrawableBalance(user, client);
            
            if (calculatedWithdrawable > 0 && calculatedWithdrawable !== parseFloat(user.withdrawable_balance)) {
                 await client.query('UPDATE users SET withdrawable_balance = $1 WHERE id = $2', [calculatedWithdrawable, userId]);
                 user.withdrawable_balance = calculatedWithdrawable;
            }

            await client.query('COMMIT');

            if (parseFloat(user.withdrawable_balance) > 0) {
                 return {
                    status: 'ready_to_withdraw',
                    amount: parseFloat(user.withdrawable_balance).toFixed(2),
                    message: `Você tem ${parseFloat(user.withdrawable_balance).toFixed(2)} disponíveis para sacar.`
                };
            }
            
            if (parseFloat(user.bonus_vault_balance) > 0) {
                return {
                    status: 'unlock_vault_prompt',
                    vaultBalance: parseFloat(user.bonus_vault_balance).toFixed(2),
                    offers: UNLOCK_OFFERS,
                    message: 'Você tem prémios no cofre! Desbloqueie-os para poder sacar.'
                };
            }

            return {
                status: 'insufficient_funds',
                message: 'Você não possui saldo sacável no momento.'
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error requesting withdrawal:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async creditDeposit(email, amount) {
        try {
            const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (userResult.rows.length === 0) {
                return { success: false, message: 'Usuário não encontrado' };
            }
            const userId = userResult.rows[0].id;
            return await this.handleDeposit(userId, amount);
        } catch (error) {
            console.error('Erro ao creditar saldo do depósito:', error);
            throw error;
        }
    }

    async handleDeposit(userId, amount) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
            let user = userResult.rows[0];

            let newBalance = parseFloat(user.balance) + amount;
            const isFirstDeposit = parseFloat(user.total_deposited) === 0;

            if (isFirstDeposit) {
                user.player_tier = amount >= VIP_DEPOSIT_THRESHOLD ? 'vip' : 'standard';
            } else if (parseFloat(user.bonus_vault_balance) > 0) {
                if (user.player_tier === 'vip' && amount >= VIP_DEPOSIT_THRESHOLD) {
                    const unlockedAmount = parseFloat(user.bonus_vault_balance);
                    newBalance += unlockedAmount;
                    user.bonus_vault_balance = 0;
                } else if (user.player_tier === 'standard') {
                    const unlockPercentage = 0.10; 
                    const unlockedAmount = parseFloat(user.bonus_vault_balance) * unlockPercentage;
                    newBalance += unlockedAmount;
                    user.bonus_vault_balance -= unlockedAmount;
                }
            }

            const updatedUser = await client.query(
                `UPDATE users SET 
                    balance = $1,
                    bonus_vault_balance = $2,
                    player_tier = $3,
                    total_deposited = total_deposited + $4,
                    deposit_rollover_progress = 0
                 WHERE id = $5 RETURNING *`,
                [newBalance, user.bonus_vault_balance, user.player_tier, amount, userId]
            );

            await client.query('COMMIT');
            return { success: true, user: updatedUser.rows[0] };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao processar depósito:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async _calculateWithdrawableBalance(user, client) {
        const lastDepositAmount = await this._getLastDepositAmount(user.id, client);
        if (parseFloat(user.deposit_rollover_progress) >= lastDepositAmount * DEPOSIT_ROLLOVER_REQUIREMENT) {
            return parseFloat(user.balance);
        }
        return 0;
    }
    
    async _getLastDepositAmount(userId, client) {
        // Lógica de placeholder. O ideal é ter uma tabela de transações.
        const userResult = await client.query('SELECT player_tier from users WHERE id = $1', [userId]);
        if (userResult.rows[0].player_tier === 'vip') return 100;
        return 30;
    }

    async processWithdrawal(userId, amount) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const userResult = await client.query("SELECT balance, withdrawable_balance FROM users WHERE id = $1 FOR UPDATE", [userId]);
            const user = userResult.rows[0];

            if (!user || parseFloat(user.withdrawable_balance) < amount) {
                throw new Error('Saldo sacável insuficiente.');
            }

            const newBalance = parseFloat(user.balance) - amount;
            const newWithdrawableBalance = parseFloat(user.withdrawable_balance) - amount;
            
            await client.query("UPDATE users SET balance = $1, withdrawable_balance = $2 WHERE id = $3", [newBalance, newWithdrawableBalance, userId]);
            
            // Aqui entraria a chamada real para o gateway de pagamento (PIX)
            
            await client.query('COMMIT');
            
            return {
                success: true,
                message: "Saque processado com sucesso."
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error processing withdrawal:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async applyAffiliateCoupon(userId, couponCode) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const userResult = await client.query('SELECT affiliate_id, balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
            const user = userResult.rows[0];

            if (user.affiliate_id) {
                throw new Error('Você já está vinculado a um afiliado.');
            }

            const affiliateResult = await client.query('SELECT id, bonus_amount FROM affiliates WHERE referral_code = $1', [couponCode]);
            const affiliate = affiliateResult.rows[0];

            if (!affiliate) {
                throw new Error('Cupão inválido ou expirado.');
            }

            await client.query('UPDATE users SET affiliate_id = $1 WHERE id = $2', [affiliate.id, userId]);

            const newBalance = parseFloat(user.balance) + parseFloat(affiliate.bonus_amount);
            await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);

            await client.query('COMMIT');

            return {
                success: true,
                message: `Cupão aplicado! Você ganhou um bónus de R$ ${parseFloat(affiliate.bonus_amount).toFixed(2)}!`,
                newBalance: newBalance.toFixed(2)
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = UserService;