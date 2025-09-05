module.exports = {
  // Regras do Funil de Jogo
  HOOK_VICTORY_MAX_PLAYS: 5,    // Garante vitória "Hook" até a 5ª jogada
  HOOK_VICTORY_AMOUNT: 100.00,  // Valor da vitória "Hook" que inaugura o cofre
  RECOVERY_WIN_LOSS_STREAK: 5,  // Ativa prémio de recuperação após 5 derrotas seguidas

  // Regras de Saque e Rollover
  DEPOSIT_ROLLOVER_REQUIREMENT: 1, // Jogador deve apostar 1x o valor do depósito para sacar
  BONUS_ROLLOVER_MULTIPLIER: 20,   // Para cada R$1 de bónus, deve-se apostar R$20 para torná-lo sacável

  // Regras de Segmentação de Jogador
  VIP_DEPOSIT_THRESHOLD: 100.00, // Valor a partir do qual um depósito é considerado VIP

  // Ofertas para Desbloqueio do Cofre (Apresentadas no Frontend)
  UNLOCK_OFFERS: [
    {
      title: 'Depósito Rápido',
      description: 'Desbloqueie 10% do seu cofre e ative o multiplicador de prêmios!',
      amount: 30.00,
      isVip: false,
    },
    {
      title: 'Melhor Valor',
      description: 'Desbloqueie 100% + bônus!',
      amount: 70.00,
      isVip: true,
      bonusText: '+ R$25 Bônus'
    }
  ],
  
  // Limites de depósito para o grande prémio (pode ser usado no futuro)
  DEPOSIT_THRESHOLDS: {
    STANDARD_GOAL: 120,
    VIP_GOAL: 200,
  },

  // Valores de recompensa (pode ser usado no futuro)
  REWARDS: {
    LARGE: 5000,
  },
};