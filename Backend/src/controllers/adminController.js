// src/controllers/adminController.js
const adminService = require('../services/adminService');
const { handleError } = require('../middleware/errorHandler');

class AdminController {
    async getStats(req, res) {
        try {
            const stats = await adminService.getPlatformStats(); // ✅ CORRETO
            
            res.status(200).json(stats);
        } catch (error) {
            handleError(res, error);
        }
    }

    async getPlayers(req, res) {
        try {
            const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
            
            // Use listPlayers em vez de getAllPlayers
            const players = await adminService.listPlayers(
                parseInt(page), 
                parseInt(limit), 
                sortBy, 
                sortOrder
            );
            
            res.status(200).json(players);
        } catch (error) {
            handleError(res, error);
        }
    }

    async createAffiliate(req, res) {
        try {
            const { name, email, referral_code, commission_rate } = req.body;
            
            // Use createAffiliate (singular) em vez de createNewAffiliate
            const affiliate = await adminService.createAffiliate({
                name, email, referral_code, commission_rate
            });
            
            res.status(201).json(affiliate);
        } catch (error) {
            handleError(res, error);
        }
    }

    async getAffiliatesSummary(req, res) {
        try {
            const summary = await adminService.getAffiliatesSummary(); // ✅ CORRETO
            
            res.status(200).json(summary);
        } catch (error) {
            handleError(res, error);
        }
    }

    async getPerformanceMetrics(req, res) {
        try {
            const metrics = await adminService.getPerformanceMetrics();
            res.status(200).json(metrics);
        } catch (error) {
            handleError(res, error);
        }
    }

    async findPlayer(req, res) {
        try {
            const { searchTerm } = req.params;
            const player = await adminService.findPlayer(searchTerm);
            
            if (!player) {
                return res.status(404).json({ message: 'Jogador não encontrado' });
            }
            
            res.status(200).json(player);
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new AdminController();