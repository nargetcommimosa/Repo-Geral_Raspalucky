const { pool } = require('../config/database');

class Transaction {
  // Registrar uma nova transação
  static async create(transactionData) {
    const {
      user_id,
      type, // 'deposit', 'withdrawal', 'game_bet', 'game_win'
      amount,
      status = 'completed',
      description = '',
      external_id = null
    } = transactionData;

    try {
      const result = await pool.query(
        `INSERT INTO transactions (user_id, type, amount, status, description, external_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user_id, type, amount, status, description, external_id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao registrar transação:', error);
      throw error;
    }
  }

  // Buscar transações por usuário
  static async findByUserId(userId, limit = 10) {
    try {
      const result = await pool.query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar transações do usuário:', error);
      throw error;
    }
  }

  // Atualizar status de uma transação
  static async updateStatus(transactionId, status) {
    try {
      const result = await pool.query(
        'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *',
        [status, transactionId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao atualizar status da transação:', error);
      throw error;
    }
  }
}

module.exports = Transaction;