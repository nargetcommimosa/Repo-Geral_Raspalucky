const { Pool } = require('pg');
require('dotenv').config();

// Configuração otimizada do pool de conexões
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : false,
  max: 20, // número máximo de clientes no pool
  idleTimeoutMillis: 30000, // tempo em ms que um cliente pode ficar idle
  connectionTimeoutMillis: 2000, // tempo máximo para tentar conectar
};

const pool = new Pool(dbConfig);

// Função para inicializar o banco de dados
async function initializeDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Criar tabela de affiliates
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        referral_code TEXT UNIQUE NOT NULL,
        commission_rate NUMERIC(5, 2) DEFAULT 10.00,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Criar tabela de users com todas as colunas necessárias
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        phone TEXT,
        balance NUMERIC(10, 2) DEFAULT 100.00,
        loss_streak INTEGER DEFAULT 0,
        total_deposited NUMERIC(10, 2) DEFAULT 0.00,
        total_wagered NUMERIC(10, 2) DEFAULT 0.00,
        affiliate_id INTEGER REFERENCES affiliates(id),
        last_bonus_claimed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDB
};