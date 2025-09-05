class NotificationService {
    constructor() {
        this.clients = new Map();
    }

    setClients(clients) {
        this.clients = clients;
    }

    notifyUser(userId, data) {
        const client = this.clients.get(userId);
        if (!client || client.readyState !== 1) return false;
        
        const notification = this.createNotification(data);
        client.send(JSON.stringify(notification));
        
        return true;
    }

    notifyAdmins(data) {
        let notified = 0;
        const notification = this.createNotification(data);
        
        this.clients.forEach((client, userId) => {
            if (client && client.readyState === 1) {
                client.send(JSON.stringify(notification));
                notified++;
            }
        });
        
        return notified;
    }

    createNotification(data) {
        return {
            type: data.type,
            amount: data.amount,
            message: data.message || 'Notificação do sistema',
            timestamp: new Date().toISOString(),
            ...data
        };
    }
}

module.exports = NotificationService;