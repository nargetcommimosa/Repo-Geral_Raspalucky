// app.js - VERSÃO PROFISSIONAL COM POSTGRESQL, BCRYPT E JWT

require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const express = require("express");
const path = require("path");
const cors = require("cors");
const { Pool } = require('pg'); // Driver do PostgreSQL
const bcrypt = require('bcrypt'); // Para hashing de senhas
const jwt = require('jsonwebtoken'); // Para autenticação

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- CONFIGURAÇÃO DO BANCO DE DADOS POSTGRESQL ---
// O Pool vai usar a string de conexão da variável de ambiente DATABASE_URL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log("Conectando ao banco de dados PostgreSQL...");

// --- FUNÇÃO DE INICIALIZAÇÃO DO BANCO DE DADOS ---
async function initializeDB() {
  try {
    // A conexão é testada com uma query simples
    const client = await db.connect();
    console.log("Conectado com sucesso ao banco de dados PostgreSQL.");
    
    // Sintaxe do PostgreSQL é um pouco diferente do SQLite
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        balance NUMERIC(10, 2) DEFAULT 100.00,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Outras tabelas que podemos recriar depois
    console.log("Tabela 'users' verificada/criada com sucesso.");
    client.release(); // Libera o cliente de volta para o pool
  } catch (e) {
    console.error("Erro fatal ao inicializar o banco de dados:", e);
    process.exit(1);
  }
}

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
// Esta função irá proteger as rotas que exigem que o usuário esteja logado
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

  if (token == null) {
    return res.sendStatus(401); // Não autorizado (sem token)
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Proibido (token inválido)
    }
    req.user = user; // Adiciona os dados do usuário (do token) ao objeto da requisição
    next(); // Passa para a próxima função (a rota em si)
  });
}

// --- ROTAS DE AUTENTICAÇÃO ---

// Endpoint de Registro (com Hashing)
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  const saltRounds = 10;

  if (!email || !password || !username) {
    return res.status(400).json({ message: "Todos os campos são obrigatórios." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const result = await db.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, email, username, balance",
      [username, email, hashedPassword]
    );

    res.status(201).json({
      message: "Usuário registrado com sucesso!",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') { // Código de erro do Postgres para violação de constraint unique
      return res.status(409).json({ message: "E-mail já cadastrado." });
    }
    console.error("Erro no registro:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// Endpoint de Login (com Hashing e gerando JWT)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
  }

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "E-mail ou senha inválidos." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "E-mail ou senha inválidos." });
    }

    // Se a senha estiver correta, GERAR O TOKEN JWT
    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }); // Token expira em 1 dia

    // Remover a senha do objeto de usuário antes de enviar
    delete user.password;

    res.status(200).json({
      message: "Login bem-sucedido!",
      token,
      user
    });

  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// --- ROTA PROTEGIDA (EXEMPLO) ---
// Para acessar esta rota, o frontend PRECISA enviar o token JWT
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, username, email, balance FROM users WHERE id = $1", 
      [req.user.userId] // req.user.userId foi adicionado pelo middleware authenticateToken
    );
    const userProfile = result.rows[0];

    if (!userProfile) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.status(200).json(userProfile);
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
initializeDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});