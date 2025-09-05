const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rotas de estatísticas
router.get('/stats', adminController.getStats);
router.get('/metrics', adminController.getPerformanceMetrics);

// Rotas de jogadores
router.get('/players', adminController.getPlayers);
router.get('/players/search/:searchTerm', adminController.findPlayer);

// Rotas de afiliados
router.get('/affiliates', adminController.getAffiliatesSummary);
router.post('/affiliates', adminController.createAffiliate);

module.exports = router;