// src/services/gameLogicService.js (Refatorado)
const { pool } = require('../config/database');
// Adicionaremos as novas constantes aqui quando criarmos o arquivo
const { HOOK_VICTORY_MAX_PLAYS, HOOK_VICTORY_AMOUNT, RECOVERY_WIN_LOSS_STREAK, REWARDS } = require('../config/constants');

class GameLogicService {
    constructor() {
        this.symbols = ['gem', 'money-bag', 'bell', 'clover', 'cherries', 'lemon', 'star'];
    }

    /**
     * Orquestra uma jogada completa com a nova lógica de funil.
     * Busca o usuário, debita do Saldo Real, determina o prêmio (hook ou recuperação),
     * credita o prêmio no Cofre e atualiza todas as estatísticas numa transação.
     */
    async processGamePlay(userId, price) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const user = userResult.rows[0];

        if (!user) throw new Error('Usuário não encontrado');
        if (parseFloat(user.balance) < price) throw new Error('Saldo insuficiente');

        let isWinner = false;
        let winningPrize = { value: 0, name: '' };

        const isHookPlayTime = user.total_plays === 3 || user.total_plays === 4;
        const hasAlreadyHadHookWin = parseFloat(user.bonus_vault_balance) >= HOOK_VICTORY_AMOUNT;

        // 1. Lógica da Vitória "Hook" (Engajamento Inicial)
        // Garante a grande vitória UMA VEZ, na 4ª ou 5ª jogada.
        if (isHookPlayTime && !hasAlreadyHadHookWin) {
            isWinner = true;
            winningPrize = {
                value: HOOK_VICTORY_AMOUNT,
                name: `Prêmio de Boas-Vindas de R$ ${HOOK_VICTORY_AMOUNT.toFixed(2)}`
            };
        }

        // 2. Lógica da Vitória de Recuperação (só ativa se a vitória "Hook" não ocorrer)
        const currentLossStreak = user.loss_streak + 1;
        if (!isWinner && currentLossStreak >= RECOVERY_WIN_LOSS_STREAK) {
            isWinner = true;
            const prizeValue = Math.floor(Math.random() * 5) + 1;
            winningPrize = {
                value: prizeValue,
                name: `Prêmio de Recuperação de R$ ${prizeValue.toFixed(2)}`
            };
        }

        const newBalance = parseFloat(user.balance) - price;
        const newBonusVaultBalance = parseFloat(user.bonus_vault_balance) + winningPrize.value;
        const newTotalWagered = parseFloat(user.total_wagered) + price;
        const newDepositRolloverProgress = parseFloat(user.deposit_rollover_progress) + price;
        const newBonusRolloverProgress = parseFloat(user.bonus_rollover_progress) + price;
        const newTotalPlays = user.total_plays + 1;
        const newLossStreak = isWinner ? 0 : currentLossStreak;

        await client.query(
            `UPDATE users SET 
                balance = $1, bonus_vault_balance = $2, loss_streak = $3, 
                total_wagered = $4, deposit_rollover_progress = $5,
                bonus_rollover_progress = $6, total_plays = $7
            WHERE id = $8`,
            [
                newBalance, newBonusVaultBalance, newLossStreak, newTotalWagered, 
                newDepositRolloverProgress, newBonusRolloverProgress, newTotalPlays, userId
            ]
        );

        await client.query('COMMIT');

        const gridSymbols = this.generateSymbolsGrid(isWinner);
        
        return {
            isWinner,
            winningPrize,
            gridSymbols,
            newBalance: newBalance.toFixed(2),
            newBonusVaultBalance: newBonusVaultBalance.toFixed(2),
            withdrawable_balance: parseFloat(user.withdrawable_balance).toFixed(2),
            success: true
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

    generateSymbolsGrid(isWinner) {
        return isWinner ? this.createWinningGrid() : this.createLosingGrid();
    }

    createWinningGrid() {
        const winningSymbol = this.getRandomSymbol();
        const grid = Array(9).fill(null);
        // Lógica para criar uma combinação vencedora visualmente
        const winningPositions = [0, 4, 8]; // Diagonal para um visual clássico
        winningPositions.forEach(pos => grid[pos] = winningSymbol);
        
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] === null) {
                grid[i] = this.getRandomSymbol(this.symbols.filter(s => s !== winningSymbol));
            }
        }
        return grid;
    }

    createLosingGrid() {
        let grid;
        let hasWinningCombination = true;
        let attempts = 0;
        while (hasWinningCombination && attempts < 20) {
            grid = Array(9).fill(null).map(() => this.getRandomSymbol());
            hasWinningCombination = this.checkWinningCombination(grid);
            attempts++;
        }
        return grid;
    }

    checkWinningCombination(grid) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
            [0, 4, 8], [2, 4, 6]  // Diagonais
        ];
        for (const line of lines) {
            const [a, b, c] = line;
            if (grid[a] && grid[a] === grid[b] && grid[a] === grid[c]) {
                return true;
            }
        }
        return false;
    }

    getRandomSymbol(symbols = this.symbols) {
        return symbols[Math.floor(Math.random() * symbols.length)];
    }
}

module.exports = GameLogicService;