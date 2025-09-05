const { Server } = require('ws');
const jwt = require('jsonwebtoken');

// ✅ CORREÇÃO: Caminho e nome corretos
const NotificationService = require('../services/notificationService');

// ✅ Criar instância do serviço
const notificationService = new NotificationService();

function setupWebSocket(server) {
    const wss = new Server({ server });
    const clients = new Map();

    // ✅ Configurar clients no serviço de notificação
    notificationService.setClients(clients);

    wss.on('connection', (ws) => {
        console.log('Nova conexão WebSocket estabelecida');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'auth' && data.token) {
                    const payload = jwt.verify(data.token, process.env.JWT_SECRET);
                    const userId = payload.userId;
                    
                    clients.set(userId, ws);
                    console.log(`Usuário ${userId} autenticado via WebSocket`);
                    
                    ws.on('close', () => {
                        clients.delete(userId);
                        console.log(`Usuário ${userId} desconectado do WebSocket`);
                    });
                }
            } catch (error) {
                console.error('Erro na autenticação WebSocket:', error.message);
                ws.close();
            }
        });

        ws.on('error', (error) => {
            console.error('Erro na conexão WebSocket:', error);
        });

        ws.on('close', () => {
            // Remover cliente da lista ao desconectar
            for (const [userId, client] of clients.entries()) {
                if (client === ws) {
                    clients.delete(userId);
                    console.log(`Usuário ${userId} desconectado`);
                    break;
                }
            }
        });
    });

    console.log('WebSocket server inicializado');
    return wss;
}

// ✅ Exportar corretamente
module.exports = {
    setupWebSocket,
    notificationService
};