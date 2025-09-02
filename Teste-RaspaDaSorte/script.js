document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO E ESTADO GLOBAL ---
    const API_URL = 'https://backend-raspa.onrender.com';
    const SOCKET_URL = 'wss://backend-raspa.onrender.com';
    
    const appState = {
        user: null,
        token: localStorage.getItem('authToken'),
        currentCardData: {},
        isGameActive: false,
        isDrawing: false,
        isCardPurchased: false,
        revealedSymbols: {},
        nearMissTriggered: false
    };

    // --- ELEMENTOS DO DOM ---
    const elements = {
        backToHomeBtn: document.getElementById('back-to-home'),
        scratchCards: document.querySelectorAll('.scratch-card'),
        winnersTrack: document.querySelector('.winners-carousel-section .carousel-track'),
        latestWinnersList: document.getElementById('latest-winners-list'),
        navButtons: document.querySelectorAll('.main-nav a[data-action], .mobile-nav a[data-action]'),
        gameModalOverlay: document.getElementById('game-modal-overlay'),
        gameTitle: document.getElementById('game-title'),
        symbolsGrid: document.getElementById('symbols-grid-underneath'),
        gameCanvas: document.getElementById('scratch-game-canvas'),
        gameResult: document.getElementById('game-result'),
        playAgainGameBtn: document.getElementById('play-again-game'),
        prizesTrack: document.getElementById('prizes-carousel-track'),
        purchaseOverlay: document.getElementById('purchase-overlay'),
        purchaseBtn: document.getElementById('purchase-btn'),
        purchasePrice: document.getElementById('purchase-price'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalContainer: document.getElementById('modal-container'),
        winConfettiCanvas: document.getElementById('win-confetti-canvas'),
        balanceDisplay: document.getElementById('balance-display'),
        mobileBalanceDisplay: document.getElementById('mobile-balance-display')
    };

    const ctx = elements.gameCanvas.getContext('2d');
    let socket = null;

    // --- SÍMBOLOS DO JOGO ---
    const symbols = {
        'gem': 'https://placehold.co/100x100/DAA520/000000?text=💎',
        'money-bag': 'https://placehold.co/100x100/DAA520/000000?text=💰',
        'bell': 'https://placehold.co/100x100/DAA520/000000?text=🔔',
        'clover': 'https://placehold.co/100x100/DAA520/000000?text=🍀',
        'cherries': 'https://placehold.co/100x100/DAA520/000000?text=🍒',
        'lemon': 'https://placehold.co/100x100/DAA520/000000?text=🍋',
        'star': 'https://placehold.co/100x100/DAA520/000000?text=⭐'
    };

    // --- INICIALIZAÇÃO ---
    function init() {
        try {
            // Processar código de referência da URL
            const urlParams = new URLSearchParams(window.location.search);
            const referralCode = urlParams.get('ref');
            if (referralCode) {
                localStorage.setItem('referralCode', referralCode);
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            checkAuthStatus();
            generateWinnersCarousel();
            generateLatestWinnersList();
            setupEventListeners();
        } catch (error) {
            console.error('Erro na inicialização:', error);
        }
    }

    // --- WEBSOCKET ---
    function connectWebSocket(token) {
        if (socket && socket.readyState === WebSocket.OPEN) return;
        
        socket = new WebSocket(SOCKET_URL);

        socket.onopen = () => {
            console.log('WebSocket Conectado.');
            socket.send(JSON.stringify({ type: 'auth', token }));
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'payment_confirmed') {
                    console.log('Pagamento confirmado via WebSocket!', data);
                    showPaymentSuccessModal(data.amount);
                }
            } catch (error) {
                console.error('Erro ao processar mensagem do WebSocket:', error);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket Desconectado. Tentando reconectar em 5 segundos...');
            setTimeout(() => {
                if (localStorage.getItem('authToken')) {
                    connectWebSocket(appState.token);
                }
            }, 5000);
        };
        
        socket.onerror = (err) => {
            console.error('Erro no WebSocket:', err);
            socket.close();
        };
    }

    // --- API COMMUNICATION ---
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
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401 || response.status === 403) {
                    logout();
                }
                throw new Error(errorData.message || 'Erro no servidor.');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            showNotification(error.message, 'error');
            return null;
        }
    }

    // --- AUTHENTICATION ---
    async function handleLogin(email, password) {
        const data = await apiRequest('/api/login', 'POST', { email, password });
        
        if (data && data.token) {
            appState.token = data.token;
            appState.user = data.user;
            localStorage.setItem('authToken', data.token);
            await checkAuthStatus();
            closeModal();
            showNotification('Login realizado com sucesso!', 'success');
        }
    }

    async function handleRegister(username, email, password, cpf, phone) {
        const referralCode = localStorage.getItem('referralCode');
        const payload = { username, email, password, cpf, phone };
        
        if (referralCode) {
            payload.referralCode = referralCode;
        }

        const data = await apiRequest('/api/register', 'POST', payload);
        
        if (data && data.token) {
            appState.token = data.token;
            appState.user = data.user;
            localStorage.setItem('authToken', data.token);
            localStorage.removeItem('referralCode');
            await checkAuthStatus();
            closeModal();
            showNotification(`Bem-vindo(a), ${data.user.username}! Conta criada com sucesso.`, 'success');
        }
    }

    function logout() {
        appState.user = null;
        appState.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('referralCode');
        
        if (socket) {
            socket.close();
            socket = null;
        }
        
        updateUIForAuthState();
        showNotification('Logout realizado com sucesso.', 'info');
    }

    async function checkAuthStatus() {
        if (appState.token) {
            const userProfile = await apiRequest('/api/user/profile');
            
            if (userProfile) {
                appState.user = userProfile;
                connectWebSocket(appState.token);
            } else {
                logout();
            }
        }
        
        updateUIForAuthState();
    }

    // --- UI MANAGEMENT ---
    function updateUIForAuthState() {
        const loginBtnDesktop = document.querySelector('.main-nav a[data-action="login"]');
        const loginBtnMobile = document.querySelector('.mobile-nav a[data-action="login"]');
        const profileBtnDesktop = document.querySelector('.main-nav a[data-action="profile"]');
        const profileBtnMobile = document.querySelector('.mobile-nav a[data-action="profile"]');
        const withdrawBtnDesktop = document.querySelector('.main-nav a[data-action="withdraw"]');
        const withdrawBtnMobile = document.querySelector('.mobile-nav a[data-action="withdraw"]');
        
        if (appState.user) {
            const userName = appState.user.username;
            
            // Atualizar botões de login para perfil
            if (loginBtnDesktop) {
                loginBtnDesktop.innerHTML = `<i class="fas fa-user"></i> ${userName}`;
                loginBtnDesktop.dataset.action = 'profile';
            }
            
            if (loginBtnMobile) {
                loginBtnMobile.querySelector('span').innerText = userName;
                loginBtnMobile.dataset.action = 'profile';
            }
            
            // Mostrar botão de saque
            if (withdrawBtnDesktop) withdrawBtnDesktop.style.display = 'inline-flex';
            if (withdrawBtnMobile) withdrawBtnMobile.style.display = 'flex';
        } else {
            // Reverter botões de perfil para login
            const profileBtnDesktop = document.querySelector('.main-nav a[data-action="profile"]');
            const profileBtnMobile = document.querySelector('.mobile-nav a[data-action="profile"]');
            
            if (profileBtnDesktop) {
                profileBtnDesktop.innerHTML = `<i class="fas fa-user"></i> Login`;
                profileBtnDesktop.dataset.action = 'login';
            }
            
            if (profileBtnMobile) {
                profileBtnMobile.querySelector('span').innerText = 'Login';
                profileBtnMobile.dataset.action = 'login';
            }
            
            // Esconder botão de saque
            if (withdrawBtnDesktop) withdrawBtnDesktop.style.display = 'none';
            if (withdrawBtnMobile) withdrawBtnMobile.style.display = 'none';
        }
        
        updateBalanceDisplay();
    }

    function updateBalanceDisplay() {
        const balance = appState.user ? parseFloat(appState.user.balance) : 0;
        const formattedBalance = `R$ ${balance.toFixed(2).replace('.', ',')}`;
        
        if (elements.balanceDisplay) elements.balanceDisplay.innerText = formattedBalance;
        if (elements.mobileBalanceDisplay) elements.mobileBalanceDisplay.innerText = formattedBalance;
    }

    // --- GAME LOGIC ---
    async function purchaseCard() {
        if (!appState.user) {
            showLoginModal();
            return;
        }
        
        const price = parseFloat(appState.currentCardData.price);
        const currentBalance = parseFloat(appState.user.balance);
        
        if (currentBalance < price) {
            handleInsufficientBalance();
            showDepositModal();
            return;
        }
        
        elements.purchaseBtn.classList.add('disabled');
        elements.gameResult.innerText = 'Boa sorte!';
        
        const gameData = await apiRequest('/api/game/play', 'POST', { price });
        
        elements.purchaseBtn.classList.remove('disabled');
        
        if (gameData) {
            appState.user.balance = gameData.newBalance;
            updateBalanceDisplay();
            appState.isCardPurchased = true;
            unlockAndStartGame(gameData);
        } else {
            setupGamePage(true);
        }
    }

    function unlockAndStartGame(outcome) {
        appState.isGameActive = true;
        elements.purchaseOverlay.classList.add('hidden');
        elements.gameResult.innerText = 'Arraste para raspar ou clique aqui para revelar!';
        elements.gameResult.style.cursor = 'pointer';
        
        // Gerar grid de símbolos
        elements.symbolsGrid.innerHTML = '';
        outcome.gridSymbols.forEach(key => {
            const symbolUrl = symbols[key] || 'https://placehold.co/100x100/333/fff?text=?';
            elements.symbolsGrid.innerHTML += `<div class="symbol-cell"><img src="${symbolUrl}" alt="${key}"></div>`;
        });
        
        elements.gameCanvas.dataset.outcome = JSON.stringify(outcome);
        setupScratchCanvas(false);
    }

    function revealCard() {
        if (!appState.isGameActive || !appState.isCardPurchased) return;
        if (!appState.isDrawing && !appState.isGameActive) return;
        
        appState.isDrawing = false;
        playSound('reveal');
        
        elements.gameCanvas.classList.add('revealing');
        
        setTimeout(() => {
            appState.isGameActive = false;
            checkGameEnd();
            elements.gameCanvas.classList.remove('revealing');
        }, 500);
    }

    function checkGameEnd() {
        const outcome = JSON.parse(elements.gameCanvas.dataset.outcome);
        const cells = elements.symbolsGrid.querySelectorAll('.symbol-cell');
        
        cells.forEach(cell => cell.classList.remove('highlight'));
        elements.playAgainGameBtn.classList.remove('pulse-encouragement');
        elements.gameResult.style.cursor = 'default';

        if (outcome.isWinner) {
            const prize = outcome.winningPrize;
            elements.gameResult.innerText = `PARABÉNS! Você ganhou ${parseFloat(prize.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}!`;
            elements.gameResult.classList.add('win');
            
            playSound('win');
            triggerWinAnimation();
            
            // Destacar símbolos vencedores
            const counts = {};
            outcome.gridSymbols.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
            const winningSymbol = Object.keys(counts).find(key => counts[key] >= 3);
            
            if (winningSymbol) {
                cells.forEach((cell, i) => {
                    if (outcome.gridSymbols[i] === winningSymbol) {
                        cell.classList.add('winner-symbol');
                    }
                });
            }
        } else {
            elements.gameResult.innerText = appState.nearMissTriggered 
                ? 'Quase! A sorte está por perto. Tente de novo!' 
                : 'Não foi desta vez. Tente novamente!';
            
            if (appState.nearMissTriggered) {
                elements.playAgainGameBtn.classList.add('pulse-encouragement');
            }
        }
        
        ctx.clearRect(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
        elements.playAgainGameBtn.classList.remove('hidden');
    }

    // --- SCRATCH CANVAS ---
    function setupScratchCanvas(isLocked) {
        setTimeout(() => {
            if (!elements.gameCanvas) return;
            
            elements.gameCanvas.width = elements.gameCanvas.clientWidth;
            elements.gameCanvas.height = elements.gameCanvas.clientHeight;
            
            ctx.clearRect(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
            
            const gradient = ctx.createLinearGradient(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
            gradient.addColorStop(0, '#333');
            gradient.addColorStop(1, '#444');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
        }, 100);
    }

    function getScratchPosition(e) {
        const rect = elements.gameCanvas.getBoundingClientRect();
        const scaleX = elements.gameCanvas.width / rect.width;
        const scaleY = elements.gameCanvas.height / rect.height;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function scratch(e) {
        if (!appState.isDrawing || !appState.isGameActive || !appState.isCardPurchased) return;
        
        e.preventDefault();
        playSound('scratch');
        
        const pos = getScratchPosition(e);
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);
        ctx.fill();

        const outcome = JSON.parse(elements.gameCanvas.dataset.outcome);
        const col = Math.floor(pos.x / (elements.gameCanvas.width / 3));
        const row = Math.floor(pos.y / (elements.gameCanvas.height / 3));
        const index = row * 3 + col;
        const symbolKey = outcome.gridSymbols[index];
        
        if (symbolKey && !appState.revealedSymbols[index]) {
            appState.revealedSymbols[index] = symbolKey;
            
            const counts = {};
            Object.values(appState.revealedSymbols).forEach(symbol => {
                counts[symbol] = (counts[symbol] || 0) + 1;
            });
            
            if (!appState.nearMissTriggered) {
                for (const symbol in counts) {
                    if (counts[symbol] === 2) {
                        appState.nearMissTriggered = true;
                        playSound('nearMiss');
                        
                        const cells = elements.symbolsGrid.querySelectorAll('.symbol-cell');
                        cells.forEach((cell, i) => {
                            if (outcome.gridSymbols[i] === symbol) {
                                cell.classList.add('highlight');
                            }
                        });
                        
                        break;
                    }
                }
            }
        }
    }

    // --- PAYMENT HANDLING ---
    async function handleGenerateQrCode() {
        const amountInput = document.getElementById('deposit-amount-input');
        const amount = amountInput.value;
        const generateBtn = document.getElementById('generate-qr-btn');
        
        generateBtn.innerText = 'Gerando...';
        generateBtn.disabled = true;

        const pixData = await apiRequest('/api/deposit/create-pix', 'POST', { amount });

        if (pixData) {
            showQrCodeModal(pixData.qrCodeBase64, pixData.qrCodeText, pixData.expiresIn, amount);
        }
        
        generateBtn.innerText = 'Gerar QR Code PIX';
        generateBtn.disabled = false;
    }

    // --- MODAL MANAGEMENT ---
    function openModal(content, onOpen = () => {}) {
        elements.modalContainer.innerHTML = content;
        elements.modalOverlay.classList.remove('hidden');
        setTimeout(onOpen, 0);
    }

    function closeModal() {
        elements.modalOverlay.classList.add('hidden');
        elements.modalContainer.innerHTML = '';
    }

    function showLoginModal(activeTab = 'login') {
        const content = `
            <div class="auth-modal-header">
                <h2 class="logo">Raspa da Sorte</h2>
            </div>
            <div class="modal-body">
                <div class="auth-tabs">
                    <button class="auth-tab" data-form="login">Login</button>
                    <button class="auth-tab" data-form="register">Criar Conta</button>
                </div>
                <div class="auth-form-container">
                    <form id="login-form">
                        <div class="form-group">
                            <label for="login-email">E-mail</label>
                            <input type="email" id="login-email" required>
                        </div>
                        <div class="form-group">
                            <label for="login-password">Senha</label>
                            <input type="password" id="login-password" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Entrar</button>
                    </form>
                    <form id="register-form">
                        <div class="form-group">
                            <label for="register-username">Nome de Usuário</label>
                            <input type="text" id="register-username" required>
                        </div>
                        <div class="form-group">
                            <label for="register-email">E-mail</label>
                            <input type="email" id="register-email" required>
                        </div>
                        <div class="form-group">
                            <label for="register-cpf">CPF</label>
                            <input type="text" id="register-cpf" placeholder="000.000.000-00" required>
                        </div>
                        <div class="form-group">
                            <label for="register-phone">Telefone</label>
                            <input type="tel" id="register-phone" placeholder="(42) 99999-9999" required>
                        </div>
                        <div class="form-group">
                            <label for="register-password">Senha</label>
                            <input type="password" id="register-password" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Criar Conta</button>
                    </form>
                </div>
            </div>`;
        
        openModal(content, () => {
            const tabs = document.querySelectorAll('.auth-tab');
            const forms = document.querySelectorAll('.auth-form-container form');
            
            const switchTab = (targetTab) => {
                tabs.forEach(tab => tab.classList.remove('active'));
                forms.forEach(form => form.classList.remove('active'));
                
                document.querySelector(`.auth-tab[data-form="${targetTab}"]`).classList.add('active');
                document.getElementById(`${targetTab}-form`).classList.add('active');
            };
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => switchTab(tab.dataset.form));
            });
            
            switchTab(activeTab);
            
            document.getElementById('login-form').addEventListener('submit', (e) => {
                e.preventDefault();
                handleLogin(
                    document.getElementById('login-email').value,
                    document.getElementById('login-password').value
                );
            });
            
            document.getElementById('register-form').addEventListener('submit', (e) => {
                e.preventDefault();
                handleRegister(
                    document.getElementById('register-username').value,
                    document.getElementById('register-email').value,
                    document.getElementById('register-password').value,
                    document.getElementById('register-cpf').value,
                    document.getElementById('register-phone').value
                );
            });
        });
    }

    // --- UTILITY FUNCTIONS ---
    function playSound(type) {
        const audioElements = {
            scratch: document.getElementById('audio-scratch'),
            reveal: document.getElementById('audio-reveal'),
            nearMiss: document.getElementById('audio-near-miss'),
            win: document.getElementById('audio-win')
        };
        
        const audio = audioElements[type];
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.error(`Erro ao tocar áudio (${type}):`, e));
        }
    }

    function showNotification(message, type = 'info') {
        // Implementar um sistema de notificação (toast) se necessário
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    function handleInsufficientBalance() {
        const balanceBtn = document.getElementById('balance-btn') || document.getElementById('mobile-balance-btn');
        if (balanceBtn) {
            balanceBtn.classList.add('shake');
            setTimeout(() => balanceBtn.classList.remove('shake'), 820);
        }
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Cartões de raspadinha
        elements.scratchCards.forEach(card => {
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
                        title: card.querySelector('h3').innerText,
                        symbols: card.dataset.symbols ? 
                            JSON.parse(card.dataset.symbols) : 
                            ['gem', 'money-bag', 'bell', 'clover', 'cherries', 'lemon', 'star']
                    };
                    
                    setupAndShowGameModal();
                }
            });
        });

        // Navegação
        elements.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.currentTarget.dataset.action;
                
                if (action === 'home') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                
                if (!appState.user && (action === 'profile' || action === 'deposit' || action === 'withdraw' || action === 'balance')) {
                    showLoginModal();
                    return;
                }
                
                switch (action) {
                    case 'login':
                        showLoginModal();
                        break;
                    case 'profile':
                        showProfileModal();
                        break;
                    case 'deposit':
                        showDepositModal();
                        break;
                    case 'withdraw':
                        showWithdrawModal();
                        break;
                }
            });
        });

        // Botões do jogo
        elements.backToHomeBtn.addEventListener('click', () => {
            elements.gameModalOverlay.classList.add('hidden');
        });
        
        elements.playAgainGameBtn.addEventListener('click', () => {
            setupGamePage(true);
        });
        
        elements.gameResult.addEventListener('click', revealCard);
        
        // Canvas events
        elements.gameCanvas.addEventListener('mousedown', (e) => {
            appState.isDrawing = true;
            scratch(e);
        });
        
        elements.gameCanvas.addEventListener('mousemove', scratch);
        elements.gameCanvas.addEventListener('mouseup', () => {
            appState.isDrawing = false;
        });
        
        elements.gameCanvas.addEventListener('touchstart', (e) => {
            appState.isDrawing = true;
            scratch(e);
        });
        
        elements.gameCanvas.addEventListener('touchmove', scratch);
        elements.gameCanvas.addEventListener('touchend', () => {
            appState.isDrawing = false;
        });
        
        // Modal overlay
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) {
                closeModal();
            }
        });
        
        // Botão de compra
        elements.purchaseBtn.addEventListener('click', purchaseCard);
    }

    // --- INITIALIZATION ---
    init();
});