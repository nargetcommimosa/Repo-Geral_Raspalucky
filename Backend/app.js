// --- IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
require('dotenv').config();
const express = require('express');
const http = require('http');

// Importações de configuração
const { db, setupMiddleware } = require('./src/config');
const websocket = require('./src/sockets/websocket'); // ✅ Importação única

// Importações de rotas
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const gameRoutes = require('./src/routes/game');
const paymentRoutes = require('./src/routes/payment');
const adminRoutes = require('./src/routes/admin');

// Importações de middleware
const { authenticateToken, authenticateAdmin } = require('./src/middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DE MIDDLEWARE ---
setupMiddleware(app);

// --- ROTAS DA APLICAÇÃO ---
app.get('/api/health', (req, res) => {
  res.status(200).send('Backend está saudável e a funcionar!');
});

// Rotas de autenticação
app.use('/api/auth', authRoutes);

// Rotas de usuário (requerem autenticação)
app.use('/api/user', authenticateToken, userRoutes);

// Rotas de jogo (requerem autenticação)
app.use('/api/game', authenticateToken, gameRoutes);

// Rotas de pagamento
app.use('/api/deposit', paymentRoutes);

// Rotas de administração (requerem chave de admin)
app.use('/api/admin', authenticateAdmin, adminRoutes);

// --- INICIALIZAÇÃO DO SERVIDOR ---
const server = http.createServer(app);

// Configurar WebSocket ✅ Usando a importação correta
const wss = websocket.setupWebSocket(server);

// Inicializar banco de dados e iniciar servidor
db.initializeDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Servidor HTTP e WebSocket rodando na porta ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Falha ao iniciar o servidor:', err);
    process.exit(1);
  });

// Exportar app para testes
module.exports = app;