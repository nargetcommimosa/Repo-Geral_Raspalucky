const { pool } = require('../config/database');
const { logError, logInfo } = require('../utils/logger');

class AdminService {
  constructor() {
    this.pool = pool;
  }

  /**
   * Obter estatísticas gerais da plataforma
   * @returns {Promise<Object>} Estatísticas consolidadas
   */
  async getPlatformStats() {
    try {
      const queries = [
        // Total de jogadores
        this.pool.query("SELECT COUNT(*) as total_players FROM users"),
        
        // Novos jogadores hoje
        this.pool.query("SELECT COUNT(*) as new_players_today FROM users WHERE created_at >= CURRENT_DATE"),
        
        // Total depositado
        this.pool.query("SELECT COALESCE(SUM(total_deposited), 0) as total_deposited FROM users"),
        
        // Total apostado
        this.pool.query("SELECT COALESCE(SUM(total_wagered), 0) as total_wagered FROM users"),
        
        // Total de afiliados
        this.pool.query("SELECT COUNT(*) as total_affiliates FROM affiliates"),
        
        // Receita total (depósitos - saldos atuais)
        this.pool.query(`
          SELECT 
            COALESCE(SUM(total_deposited), 0) - COALESCE(SUM(balance), 0) as total_revenue 
          FROM users
        `)
      ];

      const results = await Promise.all(queries);
      
      return {
        totalPlayers: parseInt(results[0].rows[0].total_players) || 0,
        newPlayersToday: parseInt(results[1].rows[0].new_players_today) || 0,
        totalDeposited: parseFloat(results[2].rows[0].total_deposited) || 0,
        totalWagered: parseFloat(results[3].rows[0].total_wagered) || 0,
        totalAffiliates: parseInt(results[4].rows[0].total_affiliates) || 0,
        totalRevenue: parseFloat(results[5].rows[0].total_revenue) || 0
      };
    } catch (error) {
      logError('Erro ao obter estatísticas da plataforma:', error);
      throw new Error('Falha ao recuperar estatísticas');
    }
  }

  /**
   * Listar todos os jogadores com paginação
   * @param {number} page - Página atual
   * @param {number} limit - Limite por página
   * @param {string} sortBy - Campo para ordenação
   * @param {string} sortOrder - Ordem (ASC/DESC)
   * @returns {Promise<Array>} Lista de jogadores
   */
  async listPlayers(page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC') {
    try {
      const offset = (page - 1) * limit;
      const validSortFields = ['username', 'email', 'balance', 'total_deposited', 'created_at'];
      const validSortOrders = ['ASC', 'DESC'];
      
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder : 'DESC';

      const query = `
        SELECT 
          u.id, u.username, u.email, u.balance, u.phone,
          u.total_deposited, u.total_wagered, u.created_at,
          a.name as affiliate_name, a.referral_code as affiliate_code
        FROM users u 
        LEFT JOIN affiliates a ON u.affiliate_id = a.id 
        ORDER BY ${sortField} ${order}
        LIMIT $1 OFFSET $2
      `;

      const result = await this.pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Erro ao listar jogadores:', error);
      throw new Error('Falha ao listar jogadores');
    }
  }

  /**
   * Buscar jogador por ID, email ou CPF
   * @param {string} searchTerm - Termo de busca
   * @returns {Promise<Object|null>} Dados do jogador
   */
  async findPlayer(searchTerm) {
    try {
      const query = `
        SELECT 
          u.*,
          a.name as affiliate_name, a.referral_code as affiliate_code
        FROM users u 
        LEFT JOIN affiliates a ON u.affiliate_id = a.id 
        WHERE u.id::TEXT = $1 OR u.email = $1 OR u.cpf = $1 OR u.username = $1
      `;

      const result = await this.pool.query(query, [searchTerm]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Erro ao buscar jogador:', error);
      throw new Error('Falha ao buscar jogador');
    }
  }

  /**
   * Atualizar saldo do jogador
   * @param {number} userId - ID do usuário
   * @param {number} amount - Valor a adicionar/subtrair
   * @param {string} reason - Motivo da alteração
   * @returns {Promise<Object>} Novo saldo
   */
  async updatePlayerBalance(userId, amount, reason = 'Ajuste administrativo') {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verificar se usuário existe
      const userCheck = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        throw new Error('Jogador não encontrado');
      }

      const currentBalance = parseFloat(userCheck.rows[0].balance);
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error('Saldo não pode ficar negativo');
      }

      // Atualizar saldo
      await client.query(
        'UPDATE users SET balance = $1 WHERE id = $2',
        [newBalance, userId]
      );

      // Registrar transação (implementar tabela de transações se necessário)
      await client.query(
        `INSERT INTO admin_transactions 
         (user_id, amount, previous_balance, new_balance, reason, admin_id) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, amount, currentBalance, newBalance, reason, 'system'] // admin_id deve vir do JWT
      );

      await client.query('COMMIT');

      logger.info(`Saldo atualizado para usuário ${userId}: ${amount} (Motivo: ${reason})`);

      return { 
        success: true, 
        previousBalance: currentBalance, 
        newBalance, 
        userId 
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Erro ao atualizar saldo:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obter resumo de afiliados com métricas
   * @returns {Promise<Array>} Lista de afiliados com estatísticas
   */
  async getAffiliatesSummary() {
    try {
      const query = `
        SELECT 
          a.id, a.name, a.email, a.referral_code, a.commission_rate,
          COUNT(u.id) as referred_users_count,
          COALESCE(SUM(u.total_deposited), 0) as referred_deposits_total,
          COALESCE(SUM(u.total_wagered), 0) as referred_wagered_total,
          COALESCE(COUNT(u.id) FILTER (WHERE u.created_at >= CURRENT_DATE - INTERVAL '7 days'), 0) as new_users_7d,
          a.created_at
        FROM affiliates a
        LEFT JOIN users u ON a.id = u.affiliate_id
        GROUP BY a.id
        ORDER BY referred_deposits_total DESC
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Erro ao obter resumo de afiliados:', error);
      throw new Error('Falha ao obter resumo de afiliados');
    }
  }

  /**
   * Criar novo afiliado
   * @param {Object} affiliateData - Dados do afiliado
   * @returns {Promise<Object>} Afiliado criado
   */
  async createAffiliate(affiliateData) {
    const { name, email, referral_code, commission_rate = 10.00, bonus_amount = 10.00 } = affiliateData;

    try {
      const query = `
        INSERT INTO affiliates (name, email, referral_code, commission_rate, bonus_amount) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        name, email, referral_code, commission_rate, bonus_amount
      ]);

      logInfo(`Novo afiliado criado: ${name} (${referral_code})`);
      return result.rows[0];

    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Código de referência ou e-mail já existe');
      }
      logError('Erro ao criar afiliado:', error);
      throw new Error('Falha ao criar afiliado');
    }
  }

  /**
   * Obter métricas de performance da plataforma
   * @returns {Promise<Object>} Métricas de performance
   */
  async getPerformanceMetrics() {
    try {
      const queries = [
        // Taxa de conversão (depositantes / total users)
        this.pool.query(`
          SELECT 
            COUNT(*) as total_users,
            COUNT(*) FILTER (WHERE total_deposited > 0) as depositing_users,
            ROUND((COUNT(*) FILTER (WHERE total_deposited > 0) * 100.0 / NULLIF(COUNT(*), 0)), 2) as conversion_rate
          FROM users
        `),
        
        // Valor médio de depósito
        this.pool.query(`
          SELECT 
            ROUND(AVG(NULLIF(total_deposited, 0)), 2) as avg_deposit_amount
          FROM users 
          WHERE total_deposited > 0
        `),
        
        // Atividade recente (últimas 24h)
        this.pool.query(`
          SELECT 
            COUNT(*) as active_users_24h
          FROM users 
          WHERE last_login_at >= NOW() - INTERVAL '24 hours'
        `)
      ];

      const results = await Promise.all(queries);
      
      return {
        totalUsers: parseInt(results[0].rows[0].total_users) || 0,
        depositingUsers: parseInt(results[0].rows[0].depositing_users) || 0,
        conversionRate: parseFloat(results[0].rows[0].conversion_rate) || 0,
        avgDepositAmount: parseFloat(results[1].rows[0].avg_deposit_amount) || 0,
        activeUsers24h: parseInt(results[2].rows[0].active_users_24h) || 0
      };
    } catch (error) {
      logger.error('Erro ao obter métricas de performance:', error);
      throw new Error('Falha ao obter métricas de performance');
    }
  }

  /**
   * Buscar transações administrativas
   * @param {number} page - Página atual
   * @param {number} limit - Limite por página
   * @returns {Promise<Array>} Lista de transações
   */
  async getAdminTransactions(page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      
      const query = `
        SELECT 
          at.*,
          u.username as user_name,
          u.email as user_email
        FROM admin_transactions at
        LEFT JOIN users u ON at.user_id = u.id
        ORDER BY at.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await this.pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Erro ao buscar transações administrativas:', error);
      throw new Error('Falha ao buscar transações administrativas');
    }
  }
}

module.exports = AdminService;