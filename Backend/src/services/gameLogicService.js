const { DEPOSIT_THRESHOLDS, REWARDS } = require('../config/constants');

class GameLogicService {
    constructor() {
        this.symbols = ['gem', 'money-bag', 'bell', 'clover', 'cherries', 'lemon', 'star'];
    }

    generateGameOutcome(user, price) {
        const { balance, loss_streak, total_deposited } = user;
        const outcome = this.initializeOutcome(loss_streak);
        const remainingPlays = Math.floor(parseFloat(balance) / parseFloat(price));

        this.determineWinCondition(outcome, remainingPlays, total_deposited, price);
        outcome.gridSymbols = this.generateSymbolsGrid(outcome.isWinner);

        return outcome;
    }

    initializeOutcome(loss_streak) {
        return {
            isWinner: false,
            winningPrize: null,
            gridSymbols: [],
            newLossStreak: loss_streak + 1
        };
    }

    determineWinCondition(outcome, remainingPlays, total_deposited, price) {
        if (remainingPlays === 1) {
            this.handleFinalPlay(outcome, total_deposited, price);
        } else if (remainingPlays === 2 && outcome.newLossStreak >= 5) {
            this.handleRecoveryPrize(outcome);
        }
    }

    handleFinalPlay(outcome, total_deposited, price) {
        if (parseFloat(total_deposited) >= DEPOSIT_THRESHOLDS.LARGE) {
            outcome.isWinner = true;
            outcome.winningPrize = {
                type: 'cash',
                value: REWARDS.LARGE,
                name: 'PRÊMIO MÁXIMO DE R$ 3.000'
            };
            outcome.newLossStreak = 0;
        } else {
            const breakEvenPrize = parseFloat(price) + (Math.random() > 0.5 ? 1 : 0);
            outcome.isWinner = true;
            outcome.winningPrize = {
                type: 'cash',
                value: breakEvenPrize,
                name: `Prêmio de Incentivo de R$ ${breakEvenPrize.toFixed(2)}`
            };
            outcome.newLossStreak = 0;
        }
    }

    handleRecoveryPrize(outcome) {
        const recoveryPrizeValue = Math.floor(Math.random() * 20) + 1;
        outcome.isWinner = true;
        outcome.winningPrize = {
            type: 'cash',
            value: recoveryPrizeValue,
            name: `Prêmio de Recuperação de R$ ${recoveryPrizeValue}`
        };
        outcome.newLossStreak = 0;
    }

    generateSymbolsGrid(isWinner) {
        return isWinner ? this.createWinningGrid() : this.createLosingGrid();
    }

    createWinningGrid() {
        const winningSymbol = this.getRandomSymbol();
        const grid = Array(9).fill(null);
        const winningPositions = this.getRandomPositions(3);

        winningPositions.forEach(pos => grid[pos] = winningSymbol);
        
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] === null) {
                grid[i] = this.getRandomSymbol(this.symbols.filter(s => s !== winningSymbol));
            }
        }

        return grid;
    }

    createLosingGrid() {
        let grid;
        let hasWinningCombination = true;
        let attempts = 0;

        while (hasWinningCombination && attempts < 10) {
            grid = Array(9).fill(null).map(() => this.getRandomSymbol());
            hasWinningCombination = this.checkWinningCombination(grid);
            attempts++;
        }

        return grid;
    }

    checkWinningCombination(grid) {
        // Verificar linhas
        for (let i = 0; i < 3; i++) {
            if (grid[i * 3] === grid[i * 3 + 1] && grid[i * 3 + 1] === grid[i * 3 + 2]) {
                return true;
            }
        }

        // Verificar colunas
        for (let i = 0; i < 3; i++) {
            if (grid[i] === grid[i + 3] && grid[i + 3] === grid[i + 6]) {
                return true;
            }
        }

        // Verificar diagonais
        if (grid[0] === grid[4] && grid[4] === grid[8]) return true;
        if (grid[2] === grid[4] && grid[4] === grid[6]) return true;

        return false;
    }

    getRandomSymbol(symbols = this.symbols) {
        return symbols[Math.floor(Math.random() * symbols.length)];
    }

    getRandomPositions(count) {
        const positions = [];
        while (positions.length < count) {
            const pos = Math.floor(Math.random() * 9);
            if (!positions.includes(pos)) positions.push(pos);
        }
        return positions;
    }
}

module.exports = GameLogicService;