const axios = require('axios');

class PaymentService {
    constructor() {
        this.apiKey = process.env.TECHBYNET_API_KEY;
        this.baseURL = 'https://api-gateway.techbynet.com';
    }

    async createPixTransaction(userData, amount) {
        try {
            const payload = this.createTransactionPayload(amount, userData);
            const response = await this.sendTransactionRequest(payload);
            
            return {
                success: true,
                qrCodeBase64: response.data.qrCode,
                qrCodeText: response.data.payUrl,
                transactionId: response.data.id,
                expiresIn: 300
            };
        } catch (error) {
            console.error('Erro ao criar transação PIX:', error.response?.data || error.message);
            return {
                success: false,
                error: 'Falha ao processar transação PIX',
                details: error.response?.data || error.message
            };
        }
    }

    createTransactionPayload(amount, userData) {
        return {
            amount: Math.round(parseFloat(amount) * 100),
            currency: "BRL",
            paymentMethod: "pix",
            installments: 1, // ✅ Campo obrigatório
            postbackUrl: `${process.env.YOUR_BACKEND_URL}/api/deposit/webhook-confirm`,
            metadata: JSON.stringify({ product: "raspadinha", userId: userData.id }), // ✅ Campo obrigatório
            traceable: true, // ✅ Campo obrigatório
            ip: userData.ip || "127.0.0.1", // ✅ Campo obrigatório
            
            customer: {
                name: userData.username,
                email: userData.email,
                phone: userData.phone || "42998202181",
                externalRef: userData.id.toString(), // ✅ Campo obrigatório
                
                document: {
                    number: userData.cpf.replace(/\D/g, ''),
                    type: "CPF"
                },
                
                // ✅ Estrutura de endereço obrigatória (valores genéricos para produto digital)
                address: {
                    street: "Produto Digital",
                    streetNumber: "S/N",
                    complement: "Não se aplica - Conteúdo Digital",
                    zipCode: "00000000",
                    neighborhood: "Não se aplica",
                    city: "Não se aplica",
                    state: "PR",
                    country: "BR"
                }
            },
            
            items: [{
                title: "Créditos Raspa da Sorte",
                unitPrice: Math.round(parseFloat(amount) * 100),
                quantity: 1,
                tangible: false,
                externalRef: "creditos-raspa-sorte-001" // ✅ Campo obrigatório
            }],
            
            pix: {
                expiresIn: 86400 // 24 horas em segundos
            }
        };
    }

    async sendTransactionRequest(payload) {
        return axios.post(
            `${this.baseURL}/api/user/transactions`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'User-Agent': 'AtivoB2B/1.0'
                },
                timeout: 30000 // 30 segundos timeout
            }
        );
    }

    async checkPaymentStatus(transactionId) {
        try {
            const response = await axios.get(
                `${this.baseURL}/api/user/transactions/${transactionId}`,
                {
                    headers: {
                        'x-api-key': this.apiKey
                    }
                }
            );

            return {
                success: true,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            console.error('Erro ao verificar status do pagamento:', error.response?.data || error.message);
            return {
                success: false,
                error: 'Falha ao verificar status do pagamento',
                details: error.response?.data || error.message
            };
        }
    }

    async processPaymentConfirmation(chargeData) {
        try {
            const amountPaid = parseFloat(chargeData.amount) / 100;
            const userEmail = chargeData.payer.email;
            
            // Aqui você implementaria a lógica para atualizar o saldo do usuário
            console.log(`Pagamento confirmado: ${amountPaid} para ${userEmail}`);
            
            return {
                success: true,
                message: "Pagamento processado com sucesso",
                amount: amountPaid,
                userEmail: userEmail
            };
        } catch (error) {
            console.error('Erro ao processar confirmação de pagamento:', error);
            return {
                success: false,
                error: 'Falha ao processar confirmação de pagamento'
            };
        }
    }
}

module.exports = PaymentService;