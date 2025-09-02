const userService = require('../services/userService');
const { handleError } = require('../middleware/errorHandler');

class UserController {
    async getProfile(req, res) {
        try {
            const { userId } = req.user;
            
            const userProfile = await userService.getUserProfile(userId);
            
            res.status(200).json(userProfile);
        } catch (error) {
            handleError(res, error);
        }
    }

    async withdraw(req, res) {
        try {
            const { amount, pixKey } = req.body;
            const { userId } = req.user;
            
            const result = await userService.processWithdrawal(userId, amount, pixKey);
            
            res.status(200).json(result);
        } catch (error) {
            handleError(res, error);
        }
    }

    async claimBonus(req, res) {
        try {
            const { userId } = req.user;
            
            const result = await userService.claimDailyBonus(userId);
            
            res.status(200).json(result);
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new UserController();