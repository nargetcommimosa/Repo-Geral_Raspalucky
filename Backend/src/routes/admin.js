const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware');

// Todas as rotas exigem autenticação de admin
router.use(authenticateAdmin);

// Rotas de administração
router.get('/stats', adminController.getStats);
router.get('/players', adminController.getPlayers);
router.post('/affiliates', adminController.createAffiliate);
router.get('/affiliates/summary', adminController.getAffiliatesSummary);

module.exports = router;