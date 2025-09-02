// Logger simples para a aplicação
function logInfo(mensagem, dados = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${mensagem}`);
    if (dados) console.log(`Dados: ${JSON.stringify(dados, null, 2)}`);
}

function logError(mensagem, erro = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${mensagem}`);
    if (erro) console.error(`Detalhes: ${erro.stack || erro}`);
}

function logWarn(mensagem, dados = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN: ${mensagem}`);
    if (dados) console.warn(`Dados: ${JSON.stringify(dados, null, 2)}`);
}

module.exports = {
    logInfo,
    logError,
    logWarn
};