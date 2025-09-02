// Validação de CPF (mantida do código original)
function validarCPF(cpf) {
    cpf = String(cpf).replace(/[^\d]+/g, '');
    if (cpf === '') return false;
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    
    let add = 0;
    for (let i = 0; i < 9; i++) {
        add += parseInt(cpf.charAt(i)) * (10 - i);
    }
    
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    
    add = 0;
    for (let i = 0; i < 10; i++) {
        add += parseInt(cpf.charAt(i)) * (11 - i);
    }
    
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

// Validar e-mail
function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validar telefone brasileiro
function validarTelefone(telefone) {
  const telefoneRegex = /^(\d{2})\s?(\d{4,5})-?(\d{4})$/;
  return telefoneRegex.test(telefone);
}

module.exports = {
    validarCPF,
    validarEmail,
    validarTelefone
};