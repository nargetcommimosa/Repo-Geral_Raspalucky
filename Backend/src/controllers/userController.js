const UserService = require('../services/userService');
const { handleError } = require('../middleware/errorHandler');

const userService = new UserService();

class UserController {
    async getProfile(req, res) {
        try {
            const { userId } = req.user;
            const userProfile = await userService.getUserProfile(userId);
            
            if (!userProfile) {
                return res.status(404).json({ message: 'Usuário não encontrado' });
            }
            
            res.status(200).json(userProfile);
        } catch (error) {
            handleError(res, error);
        }
    }

    async requestWithdrawal(req, res) {
        try {
            const { userId } = req.user;
            const result = await userService.requestWithdrawal(userId);
            res.status(200).json(result);
        } catch (error) {
            handleError(res, error);
        }
    }

    async withdraw(req, res) {
        try {
            const { amount, pixKey } = req.body; 
            const { userId } = req.user;
            
            const result = await userService.processWithdrawal(userId, amount);
            
            res.status(200).json(result);
        } catch (error) {
            handleError(res, error);
        }
    }

    async applyAffiliateCoupon(req, res) {
        try {
            const { userId } = req.user;
            const { couponCode } = req.body;

            if (!couponCode) {
                return res.status(400).json({ message: 'O código do cupão é obrigatório.' });
            }

            const result = await userService.applyAffiliateCoupon(userId, couponCode);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
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