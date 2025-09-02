function authenticateAdmin(req, res, next) {
    const adminKey = req.headers['admin-secret-key'];
    
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    
    next();
}

module.exports = authenticateAdmin;