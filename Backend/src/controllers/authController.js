// src/controllers/authController.js (Refatorado)
const authService = require('../services/authService');
const { handleError } = require('../middleware/errorHandler');

class AuthController {
    async register(req, res) {
        try {
            const { user, token } = await authService.registerUser(req.body);
            
            res.status(201).json({
                message: "Usuário registrado com sucesso!",
                user,
                token
            });
        } catch (error) {
            // Tratamento de erro específico para registo
            if (error.message.includes('já cadastrado')) {
                return res.status(409).json({ success: false, message: error.message });
            }
            if (error.message.includes('inválido')) {
                return res.status(400).json({ success: false, message: error.message });
            }
            handleError(res, error);
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await authService.authenticateUser(email, password);

            if (!user) {
                return res.status(401).json({ message: 'E-mail ou senha inválidos' });
            }

            const token = authService.generateToken(user);

            res.status(200).json({
                message: "Login bem-sucedido!",
                token,
                user
            });
        } catch (error) {
            handleError(res, error);
        }
    }
}

module.exports = new AuthController();