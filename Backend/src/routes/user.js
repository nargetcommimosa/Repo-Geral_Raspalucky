const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

router.get('/profile', authenticateToken, userController.getProfile);
router.post('/withdraw', authenticateToken, userController.withdraw);
router.post('/claim-bonus', authenticateToken, userController.claimBonus);

module.exports = router;