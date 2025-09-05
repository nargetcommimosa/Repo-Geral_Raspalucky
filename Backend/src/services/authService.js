const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { validarCPF, validarEmail } = require('../utils/validators');

class AuthService {
    async registerUser(userData) {
        const { username, email, password, cpf, phone, referralCode } = userData;

        // Validação de dados de entrada
        if (!validarEmail(email)) throw new Error('E-mail inválido');
        if (!validarCPF(cpf)) throw new Error('CPF inválido');
        if (!password || password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const hashedPassword = await bcrypt.hash(password, 10);
            const { affiliateId, bonusAmount } = await this.processReferral(referralCode);

            const initialBalance = bonusAmount;

            const result = await client.query(
                `INSERT INTO users (username, email, password, cpf, phone, balance, affiliate_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 RETURNING id, username, email, phone, balance`,
                [username, email, hashedPassword, cpf.replace(/\D/g, ''), phone, initialBalance, affiliateId]
            );

            const newUser = result.rows[0];

            // Gerar o token imediatamente após criar o utilizador
            const token = this.generateToken(newUser);

            await client.query('COMMIT');
            
            // Retornar o utilizador como o token
            return { user: newUser, token };

        } catch (error) {
            await client.query('ROLLBACK');
            if (error.code === '23505') { 
                throw new Error('E-mail ou CPF já cadastrado.');
            }
            throw error;
        } finally {
            client.release();
        }
    }

    async processReferral(referralCode) {
        let affiliateId = null;
        let bonusAmount = 0;

        if (referralCode) {
            const affiliateResult = await pool.query(
                "SELECT id FROM affiliates WHERE referral_code = $1",
                [referralCode]
            );

            if (affiliateResult.rows.length > 0) {
                affiliateId = affiliateResult.rows[0].id;
                bonusAmount = 20.00;
            }
        }

        return { affiliateId, bonusAmount };
    }

    async authenticateUser(email, password) {
        if (!email || !password) {
            throw new Error('E-mail e senha são obrigatórios.');
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = result.rows[0];
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    generateToken(user) {
        return jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
    }
}

module.exports = new AuthService();