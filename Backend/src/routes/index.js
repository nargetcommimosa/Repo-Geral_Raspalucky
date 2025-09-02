const express = require('express');
const router = express.Router();

// Importar todas as rotas
const authRoutes = require('./auth');
const userRoutes = require('./user');
const gameRoutes = require('./game');
const paymentRoutes = require('./payment');
const adminRoutes = require('./admin');

// Health check (igual ao original)
router.get('/health', (req, res) => {
  res.status(200).send('Backend está saudável e a funcionar!');
});

// Configurar rotas
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/game', gameRoutes);
router.use('/deposit', paymentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;