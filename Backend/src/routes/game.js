const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { authenticateToken } = require('../middleware/auth');

router.post('/play', authenticateToken, gameController.playGame);

module.exports = router;