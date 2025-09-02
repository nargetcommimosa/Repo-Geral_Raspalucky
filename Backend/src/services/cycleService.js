const { DEPOSIT_THRESHOLDS, REWARDS } = require('../config/constants');

class CycleService {
    constructor() {
        this.playerSessions = new Map();
    }

    processDeposit(userId, amount) {
        const session = this.getSession(userId);
        session.totalDeposited += amount;
        this.checkRewardThresholds(session);
        return session;
    }

    checkRewardCycle(userId, betAmount, gameOutcome) {
        const session = this.getSession(userId);
        
        if (gameOutcome.isWinner) {
            session.consecutiveLosses = 0;
            session.lastWinAmount = gameOutcome.winningPrize.value;
        } else {
            session.consecutiveLosses++;
        }
        
        session.totalWagered += betAmount;
        
        return this.calculateSpecialReward(session);
    }

    calculateSpecialReward(session) {
        const { totalDeposited, consecutiveLosses } = session;
        
        if (consecutiveLosses >= 10 && totalDeposited >= DEPOSIT_THRESHOLDS.SMALL) {
            return this.createReward('consolation', Math.min(totalDeposited * 0.15, 50));
        }
        
        if (totalDeposited >= DEPOSIT_THRESHOLDS.MEDIUM * 0.8 && 
            totalDeposited < DEPOSIT_THRESHOLDS.MEDIUM && 
            consecutiveLosses >= 5) {
            return this.createReward('medium', REWARDS.MEDIUM);
        }
        
        if (totalDeposited >= DEPOSIT_THRESHOLDS.LARGE) {
            return this.createReward('large', REWARDS.LARGE);
        }
        
        return null;
    }

    createReward(type, amount) {
        const messages = {
            consolation: 'Grande prêmio! Você teve sorte!',
            medium: 'Prêmio especial! Você é sortudo!',
            large: 'JACKPOT! Você ganhou o grande prêmio!'
        };
        
        return {
            type,
            amount,
            message: messages[type]
        };
    }

    prepareRedemptionOffers(winAmount) {
        return [
            this.createOffer(59.99, winAmount * 0.3, "ULTIMAS HORAS!"),
            this.createOffer(39.99, winAmount * 0.2, "FALTAM POUCOS MINUTOS!"),
            this.createOffer(19.99, winAmount * 0.1, "ESGOTANDO!")
        ];
    }

    createOffer(amount, bonus, urgency) {
        return {
            amount,
            bonus,
            urgency,
            message: this.generateOfferMessage(amount, bonus, urgency),
            expiresIn: this.calculateExpiration(urgency)
        };
    }

    generateOfferMessage(amount, bonus, urgency) {
        const messages = {
            "ULTIMAS HORAS!": `Adicione R$ ${amount} agora e ganhe mais R$ ${bonus.toFixed(2)} instantaneamente! Oferta limitada!`,
            "FALTAM POUCOS MINUTOS!": `ULTIMA CHANCE! Adicione R$ ${amount} e receba R$ ${bonus.toFixed(2)} extra!`,
            "ESGOTANDO!": `OFERTA RELÂMPAGO! R$ ${amount} por R$ ${bonus.toFixed(2)} em créditos!`
        };
        
        return messages[urgency];
    }

    calculateExpiration(urgency) {
        const expirationTimes = {
            "ULTIMAS HORAS!": 300,
            "FALTAM POUCOS MINUTOS!": 180,
            "ESGOTANDO!": 120
        };
        
        return expirationTimes[urgency];
    }

    getSession(userId) {
        if (!this.playerSessions.has(userId)) {
            this.playerSessions.set(userId, this.initializeSession(userId));
        }
        return this.playerSessions.get(userId);
    }

    initializeSession(userId) {
        return {
            userId,
            totalDeposited: 0,
            totalWagered: 0,
            consecutiveLosses: 0,
            lastWinAmount: 0,
            rewardQueue: []
        };
    }
}

module.exports = CycleService;