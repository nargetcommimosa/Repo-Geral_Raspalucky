function setupWebSocket(server) {
    const wss = new Server({ server });
    const clients = new Map();

    // Configurar clients no serviço de notificação
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
                    console.log(`Usuário ${userId} conectou via WebSocket.`);
                    
                    ws.on('close', () => {
                        clients.delete(userId);
                        console.log(`Usuário ${userId} desconectou do WebSocket.`);
                    });
                }
            } catch (e) {
                console.error("Erro na autenticação do WebSocket:", e.message);
                ws.close();
            }
        });
    });

    console.log('WebSocket server inicializado');
    return wss;
}

module.exports = {
    setupWebSocket,
    notificationService
};