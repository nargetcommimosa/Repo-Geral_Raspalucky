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

    // Criar tabela de affiliates (sem alterações)
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        referral_code TEXT UNIQUE NOT NULL,
        commission_rate NUMERIC(5, 2) DEFAULT 10.00,
        bonus_amount NUMERIC(10, 2) DEFAULT 10.00,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Criar ou atualizar a tabela de users com as novas colunas
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT UNIQUE NOT NULL,
        phone TEXT,
        balance NUMERIC(10, 2) DEFAULT 0.00, -- Saldo Real
        loss_streak INTEGER DEFAULT 0,
        total_deposited NUMERIC(10, 2) DEFAULT 0.00,
        total_wagered NUMERIC(10, 2) DEFAULT 0.00,
        affiliate_id INTEGER REFERENCES affiliates(id),
        last_bonus_claimed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),

        -- NOVAS COLUNAS PARA O FUNIL
        bonus_vault_balance NUMERIC(10, 2) DEFAULT 0.00, -- O Cofre de Prémios
        withdrawable_balance NUMERIC(10, 2) DEFAULT 0.00, -- Saldo Sacável
        deposit_rollover_progress NUMERIC(10, 2) DEFAULT 0.00, -- Rastreia a aposta 1x do depósito
        bonus_rollover_progress NUMERIC(10, 2) DEFAULT 0.00, -- Rastreia a aposta do bónus convertido
        total_plays INTEGER DEFAULT 0, -- Controla a vitória "Hook" inicial
        player_tier TEXT DEFAULT 'standard' -- Segmenta jogadores ('standard' ou 'vip')
      );
    `);

    const columns = [
      { name: 'bonus_vault_balance', type: 'NUMERIC(10, 2) DEFAULT 0.00' },
      { name: 'withdrawable_balance', type: 'NUMERIC(10, 2) DEFAULT 0.00' },
      { name: 'deposit_rollover_progress', type: 'NUMERIC(10, 2) DEFAULT 0.00' },
      { name: 'bonus_rollover_progress', type: 'NUMERIC(10, 2) DEFAULT 0.00' },
      { name: 'total_plays', type: 'INTEGER DEFAULT 0' },
      { name: 'player_tier', type: 'TEXT DEFAULT \'standard\'' }
    ];

    for (const col of columns) {
      await client.query(`
        DO $$
        BEGIN
          BEGIN
            ALTER TABLE users ADD COLUMN ${col.name} ${col.type};
          EXCEPTION
            WHEN duplicate_column THEN RAISE NOTICE 'column ${col.name} already exists in users.';
          END;
        END;
        $$;
      `);
    }

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