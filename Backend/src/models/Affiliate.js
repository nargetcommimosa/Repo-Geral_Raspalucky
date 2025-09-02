const { pool } = require('../config/database');

class Affiliate {
  // Buscar afiliado por código de referência
  static async findByReferralCode(referralCode) {
    try {
      const result = await pool.query(
        'SELECT * FROM affiliates WHERE referral_code = $1',
        [referralCode]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao buscar afiliado por código:', error);
      throw error;
    }
  }

  // Criar novo afiliado
  static async create(affiliateData) {
    const { name, email, referral_code, commission_rate = 10.00 } = affiliateData;
    
    try {
      const result = await pool.query(
        `INSERT INTO affiliates (name, email, referral_code, commission_rate)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, email, referral_code, commission_rate]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao criar afiliado:', error);
      throw error;
    }
  }

  // Buscar resumo de afiliados
  static async getSummary() {
    try {
      const result = await pool.query(`
        SELECT 
          a.id, a.name, a.referral_code, a.commission_rate,
          COUNT(u.id) as referred_users_count,
          COALESCE(SUM(u.total_deposited), 0) as referred_deposits_total
        FROM affiliates a
        LEFT JOIN users u ON a.id = u.affiliate_id
        GROUP BY a.id
        ORDER BY a.name ASC
      `);
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar resumo de afiliados:', error);
      throw error;
    }
  }

  // Buscar todos os afiliados
  static async findAll() {
    try {
      const result = await pool.query('SELECT * FROM affiliates ORDER BY name ASC');
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar afiliados:', error);
      throw error;
    }
  }
}

module.exports = Affiliate;