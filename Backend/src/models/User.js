const { pool } = require('../config/database');

class User {
  // Buscar usuário por ID
  static async findById(id) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao buscar usuário por ID:', error);
      throw error;
    }
  }

  // Buscar usuário por email
  static async findByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      throw error;
    }
  }

  // Criar novo usuário
  static async create(userData) {
    const {
      username,
      email,
      password,
      cpf,
      phone,
      balance = 100.00,
      affiliate_id = null
    } = userData;

    try {
      const result = await pool.query(
        `INSERT INTO users (username, email, password, cpf, phone, balance, affiliate_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, username, email, balance, phone, created_at`,
        [username, email, password, cpf, phone, balance, affiliate_id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  // Atualizar saldo do usuário
  static async updateBalance(userId, newBalance) {
    try {
      const result = await pool.query(
        'UPDATE users SET balance = $1 WHERE id = $2 RETURNING balance',
        [newBalance, userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao atualizar saldo:', error);
      throw error;
    }
  }

  // Atualizar streak de perdas
  static async updateLossStreak(userId, lossStreak) {
    try {
      const result = await pool.query(
        'UPDATE users SET loss_streak = $1 WHERE id = $2 RETURNING loss_streak',
        [lossStreak, userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao atualizar loss streak:', error);
      throw error;
    }
  }

  // Adicionar ao total depositado
  static async addToTotalDeposited(userId, amount) {
    try {
      const result = await pool.query(
        'UPDATE users SET total_deposited = total_deposited + $1 WHERE id = $2 RETURNING total_deposited',
        [amount, userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao atualizar total depositado:', error);
      throw error;
    }
  }

  // Buscar todos os usuários (para admin)
  static async findAll() {
    try {
      const result = await pool.query(`
        SELECT u.id, u.username, u.email, u.balance, u.total_deposited, u.created_at, a.name as affiliate_name 
        FROM users u 
        LEFT JOIN affiliates a ON u.affiliate_id = a.id 
        ORDER BY u.created_at DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar todos os usuários:', error);
      throw error;
    }
  }

  // Buscar estatísticas de usuários (para admin)
  static async getStats() {
    try {
      const totalPlayersRes = await pool.query("SELECT COUNT(*) FROM users");
      const newPlayersRes = await pool.query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - interval '1 day'");
      const totalDepositedRes = await pool.query("SELECT SUM(total_deposited) FROM users");

      return {
        totalPlayers: totalPlayersRes.rows[0].count || '0',
        newPlayersToday: newPlayersRes.rows[0].count || '0',
        totalDeposited: totalDepositedRes.rows[0].sum || '0.00'
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }
}

module.exports = User;