document.addEventListener('DOMContentLoaded', () => {

// --- CONFIGURAÇÃO E ESTADO GLOBAL ---
    const API_URL = 'http://localhost:3000'; // Mude para a URL da Railway quando for para produção
    let appState = {
        user: null,
        token: null,
        currentCardData: {},
        isGameActive: false,
        isDrawing: false
    };
    
    const loginBtn = document.querySelector('a[data-action="login"]');
    const withdrawBtn = document.querySelector('a[data-action="withdraw"]');


    // --- FUNÇÕES DE AUTENTICAÇÃO E API ---
    async function apiRequest(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (appState.token) {
            headers['Authorization'] = `Bearer ${appState.token}`;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            });

            if (response.status === 401 || response.status === 403) {
                logout();
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erro na requisição');
            }
            return data;
        } catch (error) {
            console.error(`Erro na API (${endpoint}):`, error);
            alert(error.message);
            return null;
        }
    }

    async function handleLogin(email, password) {
        const data = await apiRequest('/api/login', 'POST', { email, password });
        if (data) {
            appState.token = data.token;
            appState.user = data.user;
            localStorage.setItem('authToken', data.token);
            updateUIForAuthState();
            closeModal();
        }
    }

    async function handleRegister(username, email, password) {
        const data = await apiRequest('/api/register', 'POST', { username, email, password });
        if (data) {
            alert('Cadastro realizado com sucesso! Faça o login para continuar.');
            showLoginModal('login');
        }
    }

    function logout() {
        appState.user = null;
        appState.token = null;
        localStorage.removeItem('authToken');
        updateUIForAuthState();
    }

    async function checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        if (token) {
            appState.token = token;
            const userProfile = await apiRequest('/api/user/profile');
            if (userProfile) {
                appState.user = userProfile;
            }
        }
        updateUIForAuthState();
    }
    
    // --- FUNÇÕES DE UI ---
    function updateBalanceDisplay() {
        const balance = appState.user ? appState.user.balance : 0.00;
        balanceDisplay.innerText = `R$ ${parseFloat(balance).toFixed(2).replace('.', ',')}`;
    }

    function updateUIForAuthState() {
        if (appState.user) {
            // Usuário logado
            loginBtn.innerHTML = `<i class="fas fa-user"></i> ${appState.user.username}`;
            loginBtn.dataset.action = 'profile'; // Ação muda para perfil
            withdrawBtn.classList.remove('hidden');
        } else {
            // Usuário deslogado
            loginBtn.innerHTML = `<i class="fas fa-user"></i> Login`;
            loginBtn.dataset.action = 'login';
            withdrawBtn.classList.add('hidden');
        }
        updateBalanceDisplay();
    }
    
    function handleInsufficientBalance() {
        balanceBtn.classList.add('shake');
        setTimeout(() => balanceBtn.classList.remove('shake'), 820);
    }
    
    // --- LÓGICA DO JOGO (REFEITA) ---
    async function handlePurchaseAndPlay() {
        if (!appState.user) {
            alert("Você precisa estar logado para jogar.");
            showLoginModal();
            return;
        }

        if (parseFloat(appState.user.balance) < appState.currentCardData.price) {
            handleInsufficientBalance();
            return;
        }
        
        // Desabilitar botão para evitar cliques duplos
        purchaseBtn.classList.add('disabled');
        gameResult.innerText = 'Processando sua aposta...';

        const gameData = await apiRequest('/api/game/play', 'POST', { 
            cardId: appState.currentCardData.id,
            price: appState.currentCardData.price
        });
        
        purchaseBtn.classList.remove('disabled');

        if (gameData) {
            // O backend é a fonte da verdade. Atualizamos nosso estado com a resposta.
            appState.user.balance = gameData.newBalance;
            updateBalanceDisplay();
            unlockAndStartGame(gameData.outcome);
        } else {
            // Se a requisição falhar, resetar o estado inicial
            setupGamePage(true);
        }
    }

    function unlockAndStartGame(outcome) {
        appState.isGameActive = true;
        purchaseOverlay.classList.add('hidden');
        gameResult.innerText = 'Arraste para raspar e boa sorte!';
        
        symbolsGrid.innerHTML = '';
        outcome.gridSymbols.forEach(key => {
            symbolsGrid.innerHTML += `
                <div class="symbol-cell">
                    <img src="${symbols[key]}" alt="${key}">
                </div>`;
        });
        
        setupScratchCanvas(false);

        // A lógica de "checkGameEnd" agora é controlada pelo `outcome` do servidor
        gameCanvas.dataset.outcome = JSON.stringify(outcome);
    }

    // A função que DETERMINAVA o resultado foi REMOVIDA.
    // Esta função agora apenas REVELA o resultado que o servidor já nos deu.
    function revealGameEnd() {
        if (!appState.isGameActive) return;
        appState.isGameActive = false;

        const outcome = JSON.parse(gameCanvas.dataset.outcome);
        
        if (outcome.isWinner) {
            const prize = outcome.winningPrize;
            if (prize.type === 'cash') {
                const prizeFormatted = prize.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                gameResult.innerText = `PARABÉNS! Você ganhou ${prizeFormatted}!`;
            } else {
                gameResult.innerText = `PARABÉNS! Você ganhou um(a) ${prize.name}!`;
                showItemWinModal(prize);
            }
            gameResult.classList.add('win');
            triggerWinAnimation();
        } else {
            gameResult.innerText = 'Não foi desta vez. Tente novamente!';
        }
        
        // Revelar a grade completamente
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
        
        playAgainGameBtn.classList.remove('hidden');
    }
    
    // --- LÓGICA DO CANVAS DE RASPADINHA (pequenas alterações) ---
    function setupScratchCanvas(isLocked) { /* ... sem alterações ... */ }
    function getScratchPosition(e) { /* ... sem alterações ... */ }

    function scratch(e) {
        if (!appState.isDrawing || !appState.isGameActive) return;
        e.preventDefault();
        
        const pos = getScratchPosition(e);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);
        ctx.fill();

        // Verificação da área raspada (simplificada)
        // Uma verificação mais precisa seria ler os pixels, mas para UX, um timeout funciona
        clearTimeout(window.scratchTimeout);
        window.scratchTimeout = setTimeout(revealGameEnd, 2000); // Revela resultado após 2s raspando
    }


    // --- MODAIS E NAVEGAÇÃO (com alterações) ---
    scratchCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="open-purchase-modal"]')) {
                if (!appState.user) {
                    showLoginModal();
                    return;
                }
                appState.currentCardData = {
                    id: card.id,
                    price: parseFloat(card.dataset.price),
                    prizes: JSON.parse(card.dataset.prizes),
                    title: card.querySelector('h3').innerText
                };
                setupAndShowGameModal();
            }
        });
    });

    function setupAndShowGameModal() {
        setupGamePage(true);
        gameModalOverlay.classList.remove('hidden');
    }

    purchaseBtn.addEventListener('click', handlePurchaseAndPlay);
    playAgainGameBtn.addEventListener('click', () => setupGamePage(true));
    backToHomeBtn.addEventListener('click', () => gameModalOverlay.classList.add('hidden'));

    function setupGamePage(isLocked) {
        gameTitle.innerText = appState.currentCardData.title;
        playAgainGameBtn.classList.add('hidden');
        gameResult.classList.remove('win');
        appState.isGameActive = false;
        
        if (isLocked) {
            gameResult.innerText = 'Clique em "Comprar" para iniciar o jogo';
            purchasePrice.innerText = `R$ ${appState.currentCardData.price.toFixed(2).replace('.', ',')}`;
            purchaseOverlay.classList.remove('hidden');
            symbolsGrid.innerHTML = '';
            setupScratchCanvas(true);
        }
        // ... Lógica de renderizar carrossel de prêmios (sem alterações)
    }

    function showLoginModal(initialTab = 'login') {
        // ... (código do modal de login sem alterações, exceto pelos event listeners)
        openModal(content, () => {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            loginForm.addEventListener('submit', (e) => { 
                e.preventDefault(); 
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                handleLogin(email, password);
            });
            
            registerForm.addEventListener('submit', (e) => { 
                e.preventDefault(); 
                const username = document.getElementById('register-username').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                handleRegister(username, email, password);
            });
            // ... (lógica das abas)
        });
    }

    // --- EVENT LISTENERS GERAIS ---
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const action = e.currentTarget.dataset.action;
            if (action === 'deposit') showDepositModal();
            else if (action === 'withdraw') showWithdrawModal();
            else if (action === 'login') showLoginModal();
            else if (action === 'profile') alert(`Olá ${appState.user.username}! Seu saldo é ${appState.user.balance}`); // Ação de perfil/logout pode ser mais elaborada
        });
    });

    // ... (Listeners de mouse/touch para o canvas de raspadinha, sem alterações)
    gameCanvas.addEventListener('mousedown', (e) => { appState.isDrawing = true; scratch(e); });
    gameCanvas.addEventListener('mousemove', (e) => { scratch(e); });
    gameCanvas.addEventListener('mouseup', () => { appState.isDrawing = false; });
    // ... etc ...

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    function initializeApp() {
        checkAuthStatus();
        // ... (outras funções de inicialização como carrossel de vencedores etc)
    }

    initializeApp();

    // --- ELEMENTOS DO DOM ---
    const homePage = document.getElementById('home-page');
    const backToHomeBtn = document.getElementById('back-to-home');
    const scratchCards = document.querySelectorAll('.scratch-card');
    const winnersTrack = document.querySelector('.winners-carousel-section .carousel-track');
    const balanceBtn = document.getElementById('balance-btn');
    const balanceDisplay = document.getElementById('balance-display');
    const navButtons = document.querySelectorAll('.main-nav a[data-action]');
    
    // Elementos do modal do jogo
    const gameModalOverlay = document.getElementById('game-modal-overlay');
    const gameTitle = document.getElementById('game-title');
    const symbolsGrid = document.getElementById('symbols-grid-underneath');
    const gameCanvas = document.getElementById('scratch-game-canvas');
    const gameResult = document.getElementById('game-result');
    const playAgainGameBtn = document.getElementById('play-again-game');
    const prizesTrack = document.getElementById('prizes-carousel-track');
    const purchaseOverlay = document.getElementById('purchase-overlay');
    const purchaseBtn = document.getElementById('purchase-btn');
    const purchasePrice = document.getElementById('purchase-price');
    const ctx = gameCanvas.getContext('2d');

    // Elementos do Modal Geral
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContainer = document.getElementById('modal-container');

    // Elemento para animação de vitória
    const winConfettiCanvas = document.getElementById('win-confetti-canvas');

    // --- DADOS E ESTADO DO JOGO ---
    let userBalance = 100.00;
    let currentCardData = {};
    let isGameActive = false;
    let isDrawing = false;
    let isCardPurchased = false;
    let gameOutcome = { isWinner: false, winningPrize: null };
    let depositTimerInterval = null;
    let scratchPoints = 0;
    let offerTimerInterval = null;

    const symbols = {
        'gem': 'https://placehold.co/100x100/DAA520/000000?text=💎',
        'money-bag': 'https://placehold.co/100x100/DAA520/000000?text=💰',
        'bell': 'https://placehold.co/100x100/DAA520/000000?text=🔔',
        'clover': 'https://placehold.co/100x100/DAA520/000000?text=🍀',
        'cherries': 'https://placehold.co/100x100/DAA520/000000?text=🍒',
        'lemon': 'https://placehold.co/100x100/DAA520/000000?text=🍋',
        'star': 'https://placehold.co/100x100/DAA520/000000?text=⭐'
    };

    // --- FUNÇÕES DE SALDO ---
    function updateBalanceDisplay() {
        balanceDisplay.innerText = `R$ ${userBalance.toFixed(2).replace('.', ',')}`;
    }

    function handleInsufficientBalance() {
        balanceBtn.classList.add('shake');
        setTimeout(() => {
            balanceBtn.classList.remove('shake');
        }, 820);
    }

    // --- GERAÇÃO DE CONTEÚDO DINÂMICO ---
    function generateWinnersCarousel() {
        const winners = [
            { name: 'Lucas S.', prizeName: 'iPhone 15 Pro', prizeValue: 'R$ 11.000,00', gameName: 'na Mina de Diamantes', icon: 'https://placehold.co/50x50/ffffff/000000?text=iPhone' },
            { name: 'Mariana P.', prizeName: 'R$ 250,00', prizeValue: 'R$ 250,00', gameName: 'na Febre do Ouro', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Roberto F.', prizeName: 'R$ 1.000,00', prizeValue: 'R$ 1.000,00', gameName: 'no Prêmio Relâmpago', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Julia A.', prizeName: 'R$ 50.000,00', prizeValue: 'R$ 50.000,00', gameName: 'no Magnata Instantâneo', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Carlos M.', prizeName: 'Moto Honda Biz', prizeValue: 'R$ 13.000,00', gameName: 'na Mina de Diamantes', icon: 'https://placehold.co/50x50/ffffff/000000?text=Moto' },
            { name: 'Fernanda L.', prizeName: 'R$ 10.000,00', prizeValue: 'R$ 10.000,00', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
        ];
        
        const fullTrack = [...winners, ...winners, ...winners, ...winners];
        
        winnersTrack.innerHTML = fullTrack.map(winner => `
            <div class="winner-card">
                <div class="winner-icon"><img src="${winner.icon}" alt="Prêmio"></div>
                <div class="winner-info">
                    <p class="name">${winner.name} ganhou</p>
                    <p class="prize-value">${winner.prizeValue.replace('R$ ', '')}<span class="currency"> R$</span></p>
                    <p class="prize-name">${winner.gameName}</p>
                </div>
            </div>
        `).join('');

        const numItems = winners.length;
        const duration = numItems * 0.4; 
        winnersTrack.style.setProperty('--scroll-duration', `${duration}s`);
    }

    // --- NAVEGAÇÃO E LÓGICA DE COMPRA ---
    scratchCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if(e.target.closest('[data-action="open-purchase-modal"]')) {
                currentCardData = {
                    id: card.id,
                    price: parseFloat(card.dataset.price),
                    prizes: JSON.parse(card.dataset.prizes),
                    title: card.querySelector('h3').innerText,
                    availableSymbols: JSON.parse(card.dataset.symbols.replace(/'/g, '"'))
                };
                showPackagePurchaseModal(currentCardData);
            }
        });
    });
    
    function setupAndShowGameModal() {
        setupGamePage(true);
        gameModalOverlay.classList.remove('hidden');
        setupScratchCanvas(true);
    }

    purchaseBtn.addEventListener('click', () => {
        if (userBalance >= currentCardData.price) {
            userBalance -= currentCardData.price;
            updateBalanceDisplay();
            isCardPurchased = true;
            unlockAndStartGame();
        } else {
            handleInsufficientBalance();
        }
    });

    backToHomeBtn.addEventListener('click', () => {
        gameModalOverlay.classList.add('hidden');
    });
    
    playAgainGameBtn.addEventListener('click', () => {
        setupGamePage(true);
    });

    // --- LÓGICA DO JOGO ---
    function setupGamePage(isLocked) {
        gameTitle.innerText = currentCardData.title;
        playAgainGameBtn.classList.add('hidden');
        gameResult.classList.remove('win');
        isCardPurchased = false;
        scratchPoints = 0;
        
        if (isLocked) {
            gameResult.innerText = 'Clique em "Comprar" para iniciar o jogo';
            purchasePrice.innerText = `R$ ${currentCardData.price.toFixed(2).replace('.', ',')}`;
            purchaseOverlay.classList.remove('hidden');
            symbolsGrid.innerHTML = '';
            setupScratchCanvas(true);
        }

        const fullPrizes = [...currentCardData.prizes, ...currentCardData.prizes];
        prizesTrack.innerHTML = fullPrizes.map(prize => {
            const prizeValue = typeof prize.value === 'number' 
                ? prize.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                : prize.value;
            return `
                <div class="prize-item ${prize.isJackpot ? 'jackpot' : ''}">
                    <div class="prize-image">
                        <img src="${prize.image}" alt="${prize.name}">
                    </div>
                    <div class="prize-details">
                        <p class="name">${prize.name}</p>
                        <p class="value">${prizeValue}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        const numPrizes = currentCardData.prizes.length;
        const prizeDuration = numPrizes * 0.09;
        prizesTrack.style.setProperty('--scroll-duration', `${prizeDuration}s`);
    }

    function unlockAndStartGame() {
        isGameActive = true;
        purchaseOverlay.classList.add('hidden');
        gameResult.innerText = 'Arraste para raspar e boa sorte!';
        const gridSymbolKeys = generateGridSymbols();
        
        symbolsGrid.innerHTML = '';
        gridSymbolKeys.forEach(key => {
            symbolsGrid.innerHTML += `
                <div class="symbol-cell">
                    <img src="${symbols[key]}" alt="${key}">
                </div>`;
        });
        
        setupScratchCanvas(false);
    }
    
    function generateGridSymbols() {
        const grid = new Array(9);
        const availableSymbols = currentCardData.availableSymbols;
        const isWinner = Math.random() < 0.3;
        let winningPrize = null;

        if (isWinner) {
            const winningSymbolKey = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
            winningPrize = currentCardData.prizes[Math.floor(Math.random() * currentCardData.prizes.length)];
            const otherSymbols = availableSymbols.filter(s => s !== winningSymbolKey);
            grid.fill(winningSymbolKey, 0, 3);
            for (let i = 3; i < 9; i++) {
                grid[i] = otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
            }
        } else {
            const nearMissSymbol = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
            const otherSymbols = availableSymbols.filter(s => s !== nearMissSymbol);
            grid.fill(nearMissSymbol, 0, 2);
            let symbolPool = [...otherSymbols, ...otherSymbols, ...otherSymbols];
            for (let i = 2; i < 9; i++) {
                let symbol;
                let tempGrid = grid.slice(0,i);
                do {
                   symbol = symbolPool.splice(Math.floor(Math.random() * symbolPool.length), 1)[0];
                } while (tempGrid.filter(s => s === symbol).length >= 2);
                grid[i] = symbol;
            }
        }
        
        gameOutcome = { isWinner, winningPrize };
        return grid.sort(() => Math.random() - 0.5);
    }

    // --- LÓGICA DO CANVAS DE RASPADINHA ---
    function setupScratchCanvas(isLocked) {
        setTimeout(() => {
            if (!gameCanvas) return;
            gameCanvas.width = gameCanvas.clientWidth;
            gameCanvas.height = gameCanvas.clientHeight;
            ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

            const gradient = ctx.createLinearGradient(0, 0, gameCanvas.width, gameCanvas.height);
            gradient.addColorStop(0, '#333');
            gradient.addColorStop(1, '#444');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

            if (!isLocked) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px Roboto';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('RASPE AQUI', gameCanvas.width / 2, gameCanvas.height / 2);
            }
        }, 100);
    }

    function getScratchPosition(e) {
        const rect = gameCanvas.getBoundingClientRect();
        const scaleX = gameCanvas.width / rect.width;
        const scaleY = gameCanvas.height / rect.height;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function scratch(e) {
        if (!isDrawing || !isGameActive || !isCardPurchased) return;
        e.preventDefault();
        
        const pos = getScratchPosition(e);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);
        ctx.fill();

        scratchPoints++;
        const SCRATCH_THRESHOLD = 150;

        if (scratchPoints > SCRATCH_THRESHOLD) {
            checkGameEnd();
        }
    }
    
    function checkGameEnd() {
        if (!isGameActive) return;
        isGameActive = false;
        
        if (gameOutcome.isWinner) {
            const prize = gameOutcome.winningPrize;
            if (prize.type === 'cash') {
                const prizeFormatted = prize.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                gameResult.innerText = `PARABÉNS! Você ganhou ${prizeFormatted}!`;
                userBalance += prize.value;
                updateBalanceDisplay();
            } else {
                gameResult.innerText = `PARABÉNS! Você ganhou um(a) ${prize.name}!`;
                showItemWinModal(prize);
            }
            gameResult.classList.add('win');
            triggerWinAnimation();
        } else {
            gameResult.innerText = 'Não foi desta vez. Tente novamente!';
        }

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
        
        playAgainGameBtn.classList.remove('hidden');
    }

    // --- ANIMAÇÃO DE VITÓRIA ---
    function triggerWinAnimation() {
        const myConfetti = confetti.create(winConfettiCanvas, { resize: true, useWorker: true });
        const duration = 2 * 1000;
        const end = Date.now() + duration;

        (function frame() {
            myConfetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#28a745', '#33cc33', '#99ff99', '#FFFFFF'] });
            myConfetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#28a745', '#33cc33', '#99ff99', '#FFFFFF'] });
            if (Date.now() < end) { requestAnimationFrame(frame); }
        }());
    }

    // --- LÓGICA DOS MODAIS ---
    function openModal(content, onOpen = () => {}) {
        modalContainer.innerHTML = content;
        modalOverlay.classList.remove('hidden');
        onOpen();
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        modalContainer.innerHTML = '';
        if (depositTimerInterval) {
            clearInterval(depositTimerInterval);
            depositTimerInterval = null;
        }
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            const closeButton = modalContainer.querySelector('.modal-close-btn');
            if (closeButton && closeButton.dataset.confirmExit) {
                showExitConfirmationModal();
            } else {
                closeModal();
            }
        }
    });

    function showPackagePurchaseModal(cardData) {
        const price = cardData.price;
        const content = `
            <div class="modal-header">
                <h3>${cardData.title}</h3>
                <button class="modal-close-btn" data-action="close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="package-option" data-quantity="1" data-price="${price * 1}">
                    <div class="package-amount">1 Jogo</div>
                    <div class="package-price">${(price * 1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div class="package-option popular" data-quantity="5" data-price="${price * 5 * 0.9}">
                    <div class="popular-tag">MAIS POPULAR</div>
                    <div class="package-amount">5 Jogos</div>
                    <div class="package-price">${(price * 5 * 0.9).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    <div class="package-bonus">10% DE DESCONTO</div>
                </div>
                <div class="package-option" data-quantity="10" data-price="${price * 10 * 0.85}">
                    <div class="package-amount">10 Jogos</div>
                    <div class="package-price">${(price * 10 * 0.85).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    <div class="package-bonus">15% DE DESCONTO</div>
                </div>
            </div>
        `;
        openModal(content, () => {
            modalContainer.querySelector('[data-action="close"]').addEventListener('click', closeModal);
            modalContainer.querySelectorAll('.package-option').forEach(option => {
                option.addEventListener('click', () => {
                    const purchasePrice = parseFloat(option.dataset.price);
                    if (userBalance >= purchasePrice) {
                        userBalance -= purchasePrice;
                        updateBalanceDisplay();
                        closeModal();
                        setupAndShowGameModal();
                    } else {
                        handleInsufficientBalance();
                        closeModal();
                    }
                });
            });
        });
    }

    function showDepositModal() {
        const values = [10, 30, 50, 100, 200, 500];
        const content = `
            <div class="modal-header">
                <h3>Depositar</h3>
                <button class="modal-close-btn" data-action="close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Valor:</label>
                    <input type="text" id="deposit-amount" value="R$ 10,00" readonly>
                </div>
                <div class="value-options" id="deposit-options">
                    ${values.map(v => `<button class="value-option ${v === 10 ? 'selected' : ''}" data-value="${v}">R$ ${v}</button>`).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="generate-qr-btn">Gerar QR Code</button>
            </div>
        `;
        openModal(content, () => {
            const options = document.getElementById('deposit-options');
            const amountInput = document.getElementById('deposit-amount');
            options.addEventListener('click', e => {
                if (e.target.classList.contains('value-option')) {
                    options.querySelector('.selected').classList.remove('selected');
                    e.target.classList.add('selected');
                    amountInput.value = `R$ ${parseFloat(e.target.dataset.value).toFixed(2).replace('.', ',')}`;
                }
            });
            document.getElementById('generate-qr-btn').addEventListener('click', () => {
                const selectedValue = parseFloat(options.querySelector('.selected').dataset.value);
                showQrCodeModal(selectedValue);
            });
            modalContainer.querySelector('[data-action="close"]').addEventListener('click', closeModal);
        });
    }

    function showQrCodeModal(value) {
        const content = `
            <div class="modal-header">
                <h3>Depositar</h3>
                <button class="modal-close-btn" data-action="close" data-confirm-exit="true">&times;</button>
            </div>
            <div class="modal-body qr-code-area">
                <p>Escaneie o QR Code abaixo usando o app do seu banco:</p>
                <div class="qr-code-placeholder">[Seu QR Code Aqui]</div>
                <p><strong>Valor: R$ ${value.toFixed(2).replace('.', ',')}</strong></p>
                <div class="pix-code">00020126... (código pix copia e cola)</div>
                <button class="btn btn-outline" id="copy-pix-btn"><i class="fas fa-copy"></i> Copiar Código</button>
                <p>O QR Code expira em: <span id="pix-timer" class="timer">05:00</span></p>
            </div>
        `;
        openModal(content, () => {
            startTimer(300, document.getElementById('pix-timer'));
            modalContainer.querySelector('[data-action="close"]').addEventListener('click', showExitConfirmationModal);
            document.getElementById('copy-pix-btn').addEventListener('click', e => {
                e.target.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                setTimeout(() => {
                    e.target.innerHTML = '<i class="fas fa-copy"></i> Copiar Código';
                }, 2000);
            });
        });
    }

    function showExitConfirmationModal() {
        const content = `
            <div class="modal-body confirmation-modal">
                <h3 class="logo">Raspa da Sorte <i class="fas fa-clover"></i></h3>
                <h3>Tem certeza? Sua oferta especial está expirando!</h3>
                <p>Deposite R$ 50 agora e jogue com R$ 150. Esta oferta de 200% é válida apenas para seu primeiro depósito.</p>
                <div class="btn-group">
                    <button class="btn btn-primary" id="continue-deposit-btn">Continuar Depósito</button>
                    <button class="btn-cancel" id="cancel-deposit-btn">Cancelar</button>
                </div>
            </div>
        `;
        openModal(content, () => {
            document.getElementById('continue-deposit-btn').addEventListener('click', () => {
                const selectedValue = 50;
                showQrCodeModal(selectedValue);
            });
            document.getElementById('cancel-deposit-btn').addEventListener('click', closeModal);
        });
    }
    
    function showWithdrawModal() {
        const values = [10, 30, 50, 100, 200, 500];
        const content = `
            <div class="modal-header">
                <h3>Sacar</h3>
                <button class="modal-close-btn" data-action="close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Valor do Saque:</label>
                    <input type="text" id="withdraw-amount" value="R$ 10,00" readonly>
                </div>
                <div class="value-options" id="withdraw-options">
                    ${values.map(v => `<button class="value-option ${v === 10 ? 'selected' : ''}" data-value="${v}">R$ ${v}</button>`).join('')}
                </div>
                <div class="form-group">
                    <label>Chave PIX:</label>
                    <input type="text" id="pix-key" placeholder="Digite sua chave PIX">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="request-withdraw-btn">Solicitar Saque</button>
            </div>
        `;
        openModal(content, () => {
            const options = document.getElementById('withdraw-options');
            const amountInput = document.getElementById('withdraw-amount');
            options.addEventListener('click', e => {
                if (e.target.classList.contains('value-option')) {
                    options.querySelector('.selected').classList.remove('selected');
                    e.target.classList.add('selected');
                    amountInput.value = `R$ ${parseFloat(e.target.dataset.value).toFixed(2).replace('.', ',')}`;
                }
            });
            document.getElementById('request-withdraw-btn').addEventListener('click', () => {
                const selectedValue = parseFloat(options.querySelector('.selected').dataset.value);
                const pixKey = document.getElementById('pix-key').value;
                if (!pixKey) {
                    alert("Por favor, insira sua chave PIX.");
                    return;
                }
                if (userBalance >= selectedValue) {
                    userBalance -= selectedValue;
                    updateBalanceDisplay();
                    showWithdrawSuccessModal();
                } else {
                    closeModal();
                    handleInsufficientBalance();
                }
            });
            modalContainer.querySelector('[data-action="close"]').addEventListener('click', closeModal);
        });
    }

    function showWithdrawSuccessModal() {
        const content = `
            <div class="modal-body confirmation-modal">
                <h3><i class="fas fa-check-circle" style="color: var(--success-green);"></i> Sucesso!</h3>
                <p>Sua solicitação de saque foi enviada! Para comemorar, liberamos uma raspadinha "Prêmio Relâmpago" por nossa conta!</p>
                <div class="btn-group">
                    <button class="btn btn-primary" id="play-free-card-btn">Jogar Raspadinha Grátis</button>
                </div>
            </div>
        `;
        openModal(content, () => {
            document.getElementById('play-free-card-btn').addEventListener('click', () => {
                closeModal();
                playFreeCard('card-premio-relampago');
            });
        });
    }

    function playFreeCard(cardId) {
        const freeCardElement = document.getElementById(cardId);
        if (freeCardElement) {
            currentCardData = {
                id: freeCardElement.id,
                price: 0,
                prizes: JSON.parse(freeCardElement.dataset.prizes),
                title: freeCardElement.querySelector('h3').innerText + " (Bônus)",
                availableSymbols: JSON.parse(freeCardElement.dataset.symbols.replace(/'/g, '"'))
            };
            setupAndShowGameModal();
            isCardPurchased = true;
            unlockAndStartGame();
        }
    }

    function showItemWinModal(prize) {
        const content = `
            <div class="modal-body confirmation-modal">
                <h3 class="logo"><i class="fas fa-box-open"></i> UAU!</h3>
                <h3>Você ganhou um prêmio incrível!</h3>
                <div class="prize-item" style="margin: 1rem auto; border-width: 2px;">
                     <div class="prize-image"><img src="${prize.image}" alt="${prize.name}"></div>
                     <div class="prize-details"><p class="name">${prize.name}</p></div>
                </div>
                <p>Nossa equipe entrará em contato com você pelo seu email de cadastro para combinar os detalhes do envio. Parabéns!</p>
                <div class="btn-group">
                    <button class="btn btn-primary" data-action="close">Ok, entendi!</button>
                </div>
            </div>
        `;
        openModal(content, () => {
            modalContainer.querySelector('[data-action="close"]').addEventListener('click', closeModal);
        });
    }


    function showLoginModal(initialTab = 'login') {
        const content = `
            <div class="modal-header auth-modal-header">
                <button class="modal-close-btn" data-action="close" style="position: absolute; top: 1rem; right: 1rem;">&times;</button>
                <h2 class="logo">Raspa da Sorte <i class="fas fa-clover"></i></h2>
                <p>Comece a concorrer a prêmios hoje!</p>
            </div>
            <div class="modal-body">
                <div class="auth-tabs">
                    <button class="auth-tab ${initialTab === 'login' ? 'active' : ''}" data-tab="login">Entrar</button>
                    <button class="auth-tab ${initialTab === 'register' ? 'active' : ''}" data-tab="register">Cadastrar</button>
                </div>

                <form id="login-form" class="${initialTab === 'login' ? '' : 'hidden'}">
                    <div class="form-group">
                        <label for="login-email">Email</label>
                        <input type="email" id="login-email" required>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Senha</label>
                        <input type="password" id="login-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Entrar</button>
                </form>

                <form id="register-form" class="${initialTab === 'register' ? '' : 'hidden'}">
                    <div class="form-group">
                        <label for="register-email">Email</label>
                        <input type="email" id="register-email" required>
                    </div>
                    <div class="form-group">
                        <label for="register-password">Escolha uma senha</label>
                        <input type="password" id="register-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Criar</button>
                </form>
            </div>
        `;
        openModal(content, () => {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const tabs = modalContainer.querySelectorAll('.auth-tab');

            modalContainer.querySelector('[data-action="close"]').addEventListener('click', closeModal);
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    if (tab.dataset.tab === 'login') {
                        loginForm.classList.remove('hidden');
                        registerForm.classList.add('hidden');
                    } else {
                        loginForm.classList.add('hidden');
                        registerForm.classList.remove('hidden');
                    }
                });
            });

            loginForm.addEventListener('submit', (e) => { e.preventDefault(); closeModal(); });
            registerForm.addEventListener('submit', (e) => { e.preventDefault(); closeModal(); });
        });
    }

    function startTimer(duration, display) {
        if (depositTimerInterval) clearInterval(depositTimerInterval);
        let timer = duration;
        depositTimerInterval = setInterval(() => {
            let minutes = parseInt(timer / 60, 10);
            let seconds = parseInt(timer % 60, 10);
            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;
            display.textContent = minutes + ":" + seconds;
            if (--timer < 0) {
                clearInterval(depositTimerInterval);
                display.textContent = "Expirado!";
            }
        }, 1000);
    }
    
    // --- GAMIFICAÇÃO, URGÊNCIA E PROVA SOCIAL ---
    function checkDailyBonus() {
        const today = new Date().toLocaleDateString("pt-BR");
        const lastLogin = localStorage.getItem('lastLoginDate');
        
        if (lastLogin !== today) {
            showDailyBonusModal();
            localStorage.setItem('lastLoginDate', today);
        }
    }

    function showDailyBonusModal() {
        const bonusAmount = 5.00;
        const content = `
            <div class="modal-body confirmation-modal">
                <h3 class="logo"><i class="fas fa-calendar-check"></i> Bônus Diário!</h3>
                <h3>Bem-vindo de volta!</h3>
                <p>Aqui está um bônus de ${bonusAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para começar o dia com sorte!</p>
                <div class="btn-group">
                    <button class="btn btn-primary" id="claim-bonus-btn">Coletar Bônus</button>
                </div>
            </div>
        `;
        openModal(content, () => {
            document.getElementById('claim-bonus-btn').addEventListener('click', () => {
                userBalance += bonusAmount;
                updateBalanceDisplay();
                closeModal();
            });
        });
    }

    function startOfferTimer() {
        const offerBanner = document.getElementById('offer-banner');
        const display = document.getElementById('offer-timer');
        if (!display || !offerBanner) return;
        
        const offerTime = 15 * 60;
        if (offerTimerInterval) clearInterval(offerTimerInterval);
        let timer = offerTime;

        offerBanner.addEventListener('click', () => {
             showDepositModal();
        });

        offerTimerInterval = setInterval(() => {
            let minutes = parseInt(timer / 60, 10);
            let seconds = parseInt(timer % 60, 10);
            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;
            display.textContent = `${minutes}:${seconds}`;
            if (--timer < 0) {
                clearInterval(offerTimerInterval);
                offerBanner.style.top = '-100px'; // Esconde o banner
            }
        }, 1000);
    }

    function generateLatestWinnersList() {
        const latestWinnersList = document.getElementById('latest-winners-list');
        if (!latestWinnersList) return;

        const latestWinners = [
            { name: 'Ricardo A.', prize: 'R$ 5.000,00', gameName: 'Febre do Ouro', gameIcon: 'https://placehold.co/50x50/B8860B/000?text=Ouro', time: 'agora' },
            { name: 'Beatriz M.', prize: 'R$ 15.000,00', gameName: 'Cofre Premiado', gameIcon: 'https://placehold.co/50x50/CCCCCC/000?text=Cofre', time: '1m atrás' },
            { name: 'Thiago L.', prize: 'R$ 500,00', gameName: 'Prêmio Relâmpago', gameIcon: 'https://placehold.co/50x50/FFFF00/000?text=Raio', time: '2m atrás' },
            { name: 'Letícia C.', prize: 'iPhone 15 Pro', gameName: 'Mina de Diamantes', gameIcon: 'https://placehold.co/50x50/afeeee/000?text=💎', time: '5m atrás' },
            { name: 'Eduardo F.', prize: 'R$ 50.000,00', gameName: 'Magnata Instantâneo', gameIcon: 'https://placehold.co/50x50/000000/FFF?text=💸', time: '8m atrás' }
        ];

        latestWinnersList.innerHTML = latestWinners.map(winner => `
            <div class="winner-entry">
                <div class="winner-game-icon">
                    <img src="${winner.gameIcon}" alt="Ícone do Jogo">
                </div>
                <div class="winner-details-text">
                    <p class="name-prize">
                        <span class="name">${winner.name}</span> ganhou <span class="prize">${winner.prize}</span>
                    </p>
                    <p class="game-name">na raspadinha ${winner.gameName}</p>
                </div>
                <div class="winner-time">${winner.time}</div>
            </div>
        `).join('');
    }

    // --- EVENT LISTENERS ---
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const action = e.currentTarget.dataset.action;
            if (action === 'deposit') showDepositModal();
            else if (action === 'withdraw') showWithdrawModal();
            else if (action === 'login') showLoginModal();
        });
    });

    gameCanvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e); });
    gameCanvas.addEventListener('mousemove', (e) => { scratch(e); });
    gameCanvas.addEventListener('mouseup', () => { isDrawing = false; });
    gameCanvas.addEventListener('mouseleave', () => { isDrawing = false; });
    gameCanvas.addEventListener('touchstart', (e) => { isDrawing = true; scratch(e); });
    gameCanvas.addEventListener('touchmove', (e) => { scratch(e); });
    gameCanvas.addEventListener('touchend', () => { isDrawing = false; });
    
    // Listener para o header dinâmico
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.main-header');
        const offerBanner = document.getElementById('offer-banner');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
            offerBanner.classList.add('hidden');
        } else {
            header.classList.remove('scrolled');
            offerBanner.classList.remove('hidden');
        }
    });


    // --- INICIALIZAÇÃO ---
    updateBalanceDisplay();
    generateWinnersCarousel();
    generateLatestWinnersList();
    checkDailyBonus();
    startOfferTimer();
    window.addEventListener('resize', () => {
        if (!gameModalOverlay.classList.contains('hidden')) {
            setupScratchCanvas(!isCardPurchased);
        }
    });
});

