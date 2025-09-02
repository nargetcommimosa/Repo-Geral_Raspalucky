// Formatar valor monetário
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Gerar string aleatória
function gerarStringAleatoria(tamanho) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let resultado = '';
    
    for (let i = 0; i < tamanho; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    
    return resultado;
}

// Calcular diferença de tempo em minutos
function diferencaEmMinutos(dataInicial, dataFinal) {
    return Math.floor((dataFinal - dataInicial) / (1000 * 60));
}

// Extrair apenas números de uma string
function extrairNumeros(string) {
    return string.replace(/\D/g, '');
}

module.exports = {
    formatarMoeda,
    gerarStringAleatoria,
    diferencaEmMinutos,
    extrairNumeros
};