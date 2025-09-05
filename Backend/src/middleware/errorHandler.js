function handleError(res, error) {
    console.error('Controller Error:', error);
    
    // Handle specific error types
    if (error.code === '23505') {
        return res.status(409).json({ 
            success: false, 
            message: "Registro duplicado." 
        });
    }
    
    if (error.message === 'Saldo insuficiente') {
        return res.status(400).json({ 
            success: false, 
            message: "Saldo insuficiente." 
        });
    }
    
    if (error.message === 'Usuário não encontrado') {
        return res.status(404).json({ 
            success: false, 
            message: "Usuário não encontrado." 
        });
    }
    
    // Generic error response
    res.status(500).json({ 
        success: false, 
        message: "Erro interno do servidor." 
    });
}

module.exports = { handleError };