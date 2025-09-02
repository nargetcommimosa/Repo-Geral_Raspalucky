const adminService = require('../services/adminService');
const { handleError } = require('../middleware/errorHandler');

class AdminController {
    async getStats(req, res) {
        try {
            const stats = await adminService.getPlatformStats();
            
            res.status(200).json(stats);
        } catch (error) {
            handleError(res, error);
        }
    }

    async getPlayers(req, res) {
        try {
            const players = await adminService.getAllPlayers();
            
            res.status(200).json(players);
        } catch (error) {
            handleError(res, error);
        }
    }

    async createAffiliate(req, res) {
        try {
            const { name, referral_code, commission_rate } = req.body;
            
            const affiliate = await adminService.createNewAffiliate({
                name, referral_code, commission_rate
            });
            
            res.status(201).json(affiliate);
        } catch (error) {
            handleError(res, error);
        }
    }

    async getAffiliatesSummary(req, res) {
        try {
            const summary = await adminService.getAffiliatesSummary();
            
            res.status(200).json(summary);
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new AdminController();