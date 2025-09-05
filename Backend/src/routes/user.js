const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

router.get('/profile', authenticateToken, userController.getProfile);

// rota para iniciar o fluxo de saque
router.post('/request-withdraw', authenticateToken, userController.requestWithdrawal);

// Rota para efetivar o saque
router.post('/withdraw', authenticateToken, userController.withdraw);

router.post('/claim-bonus', authenticateToken, userController.claimBonus);

router.post('/apply-coupon', authenticateToken, userController.applyAffiliateCoupon);

module.exports = router;