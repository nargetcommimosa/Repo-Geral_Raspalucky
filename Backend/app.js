// --- IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
require('dotenv').config();
const express = require('express');
const http = require('http');

// Importações de configuração
const { db, setupMiddleware } = require('./src/config');
const setupWebSocket = require('./src/sockets/websocket');

// Importações de rotas
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const gameRoutes = require('./src/routes/game');
const paymentRoutes = require('./src/routes/payment');
const adminRoutes = require('./src/routes/admin');

// Importações de middleware
const { authenticateToken, authenticateAdmin } = require('./src/middleware');
const { validarCPF } = require('./src/utils/validators');

const { setupWebSocket, notificationService } = require('./src/sockets/websocket');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DE MIDDLEWARE ---
setupMiddleware(app);

// --- ROTAS DA APLICAÇÃO ---
app.get('/api/health', async (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    };

    try {
        // Verificar conexão com banco
        await pool.query('SELECT 1');
        healthCheck.database = 'connected';
    } catch (error) {
        healthCheck.database = 'disconnected';
        healthCheck.status = 'unhealthy';
    }

    // Verificar WebSocket
    healthCheck.websocket = {
        clients: notificationService.clients.size,
        status: notificationService.clients.size > 0 ? 'active' : 'inactive'
    };

    res.status(healthCheck.status === 'OK' ? 200 : 503).json(healthCheck);
});

// Rotas de autenticação
app.use('/api/auth', authRoutes);

// Rotas de usuário (requerem autenticação)
app.use('/api/user', authenticateToken, userRoutes);

// Rotas de jogo (requerem autenticação)
app.use('/api/game', authenticateToken, gameRoutes);

app.set('trust proxy', true); // Para funcionar atrás de proxy/reverse proxy

// Ou adicione este middleware específico
app.use((req, res, next) => {
    req.realIp = req.ip || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);
    next();
})

// Rotas de pagamento
app.use('/api/deposit', paymentRoutes); // webhook não precisa de autenticação

// Rotas de administração (requerem chave de admin)
app.use('/api/admin', authenticateAdmin, adminRoutes);

// --- INICIALIZAÇÃO DO SERVIDOR ---
const server = http.createServer(app);

// Configurar WebSocket
setupWebSocket(server);

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

// Exportar app para testes (opcional)
module.exports = app;