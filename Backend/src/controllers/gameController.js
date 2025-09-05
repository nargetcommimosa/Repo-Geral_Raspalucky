const GameLogicService = require('../services/gameLogicService');
const { handleError } = require('../middleware/errorHandler');

const gameService = new GameLogicService();

class GameController {
    async playGame(req, res) {
        try {
            const { price } = req.body;
            const { userId } = req.user;

            if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
                return res.status(400).json({ success: false, message: 'Preço do jogo inválido' });
            }
            
            const gameResult = await gameService.processGamePlay(userId, parseFloat(price));
            
            res.status(200).json({ success: true, ...gameResult });
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new GameController();