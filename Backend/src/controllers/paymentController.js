const PaymentService = require('../services/paymentService');
const { pool } = require('../config/database');
const { handleError } = require('../middleware/errorHandler');

const paymentService = new PaymentService();

class PaymentController {
    async createPixDeposit(req, res) {
        try {
            const { amount } = req.body;
            const { userId } = req.user;
            
            // Capturar IP do usuário (importante para a TechBynet)
            const userIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            
            // Buscar dados completos do usuário
            const userResult = await pool.query(
                "SELECT id, username, email, cpf, phone FROM users WHERE id = $1",
                [userId]
            );
            
            const userData = userResult.rows[0];
            if (!userData) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Usuário não encontrado." 
                });
            }
            
            // Adicionar IP aos dados do usuário
            userData.ip = userIp;
            
            const pixData = await paymentService.createPixTransaction(userData, amount);
            
            if (!pixData.success) {
                return res.status(400).json({ 
                    success: false, 
                    message: pixData.error,
                    details: pixData.details 
                });
            }
            
            res.status(200).json({
                success: true,
                ...pixData
            });
        } catch (error) {
            handleError(res, error);
        }
    }

    async processWebhook(req, res) {
        try {
            const { event, data } = req.body;
            
            console.log('Webhook recebido:', { event, data });
            
            if (event === 'charge.paid') {
                const result = await paymentService.processPaymentConfirmation(data);
                
                if (result.success) {
                    // Aqui você implementaria a lógica para creditar o saldo
                    await this.creditUserBalance(result.userEmail, result.amount);
                }
                
                res.status(200).json({ 
                    success: true, 
                    message: "Webhook processado com sucesso." 
                });
            } else {
                res.status(200).json({ 
                    success: true, 
                    message: "Webhook recebido (não actionável)." 
                });
            }
        } catch (error) {
            console.error('Erro no webhook:', error);
            res.status(500).json({ 
                success: false, 
                message: "Erro interno no processamento do webhook." 
            });
        }
    }

    async creditUserBalance(email, amount) {
        try {
            await pool.query(
                `UPDATE users 
                 SET balance = balance + $1, 
                     total_deposited = total_deposited + $1 
                 WHERE email = $2`,
                [amount, email]
            );
            console.log(`Saldo de R$ ${amount} creditado para: ${email}`);
        } catch (error) {
            console.error('Erro ao creditar saldo:', error);
        }
    }

    async checkPaymentStatus(req, res) {
        try {
            const { transactionId } = req.params;
            
            const status = await paymentService.checkPaymentStatus(transactionId);
            
            if (!status.success) {
                return res.status(400).json(status);
            }
            
            res.status(200).json(status);
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new PaymentController();