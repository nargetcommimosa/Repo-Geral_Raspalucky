const gameService = require('../services/gameService');
const { handleError } = require('../middleware/errorHandler');

class GameController {
    async playGame(req, res) {
        try {
            const { price } = req.body;
            const { userId } = req.user;
            
            const gameResult = await gameService.processGamePlay(userId, price);
            
            res.status(200).json(gameResult);
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new GameController();