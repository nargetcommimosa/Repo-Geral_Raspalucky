const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

class AuthService {
    async registerUser(userData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const { affiliateId, bonusAmount } = await this.processReferral(userData.referralCode);
            
            const initialBalance = 100.00 + bonusAmount;
            
            const result = await client.query(
                `INSERT INTO users (username, email, password, cpf, phone, balance, affiliate_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 RETURNING id, username, email, phone, balance`,
                [userData.username, userData.email, hashedPassword, 
                 userData.cpf.replace(/\D/g, ''), userData.phone, initialBalance, affiliateId]
            );
            
            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
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
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1", 
            [email]
        );
        
        const user = result.rows[0];
        if (!user) return null;
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;
        
        // Remover senha do objeto de usuário
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

module.exports = AuthService;