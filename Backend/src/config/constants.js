// Constantes da aplicação
module.exports = {
  // Limites de depósito para recompensas
  DEPOSIT_THRESHOLDS: {
    SMALL: 30,
    MEDIUM: 80,
    LARGE: 120,
  },

  // Valores de recompensa
  REWARDS: {
    CONSOLATION: { min: 5, max: 10 },
    MEDIUM: 100,
    LARGE: 5000,
  },

  // Configurações de JWT
  JWT: {
    EXPIRES_IN: '1d',
    REFRESH_EXPIRES_IN: '7d',
  },

  // Configurações de jogo
  GAME: {
    BASE_WIN_PROBABILITY: 0.2,
    MAX_CONSECUTIVE_LOSSES: 10,
  },

  // URLs de API externas
  API_URLS: {
    TECHBYNET: 'https://api-gateway.techbynet.com',
  },

  // Mensagens de erro
  ERROR_MESSAGES: {
    INVALID_CREDENTIALS: 'E-mail ou senha inválidos',
    INSUFFICIENT_BALANCE: 'Saldo insuficiente',
    USER_NOT_FOUND: 'Usuário não encontrado',
    GAME_PRICE_INVALID: 'Preço do jogo inválido',
  },
};