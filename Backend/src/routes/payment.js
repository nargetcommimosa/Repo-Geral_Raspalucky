const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// Rota para criar depósito PIX
router.post('/create-pix', authenticateToken, paymentController.createPixDeposit);

// Rota para webhook de confirmação
router.post('/webhook-confirm', paymentController.processWebhook);

// Rota para verificar status do pagamento
router.get('/status/:transactionId', authenticateToken, paymentController.checkPaymentStatus);

module.exports = router;