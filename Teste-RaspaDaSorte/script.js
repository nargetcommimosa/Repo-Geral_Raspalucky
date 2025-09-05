document.addEventListener('DOMContentLoaded', () => {

    /**
     * Módulo de Configuração
     * Centraliza URLs e constantes da aplicação.
     */
    const Config = {
        API_URL: 'https://backend-raspa.onrender.com',
        SOCKET_URL: 'wss://backend-raspa.onrender.com'
    };

    /**
     * Módulo de Estado (State)
     * Armazena o estado dinâmico da aplicação.
     */
    const State = {
        user: null, // Será preenchido com { balance, bonus_vault_balance, withdrawable_balance, ... }
        token: localStorage.getItem('authToken'),
        socket: null,
        currentCardData: {},
        isDrawing: false,
        isCardPurchased: false,
    };
    /**
     * Módulo de Elementos (Elements)
     * Mapeia e armazena referências para os elementos do DOM.
     */
    const Elements = {
        // Seletor corrigido para encontrar TODOS os botões de ação clicáveis
        navButtons: document.querySelectorAll('a[data-action], button[data-action]'), 
        
        // Mapeamento dos saldos e cofre
        balanceDisplay: document.getElementById('balance-display'),
        mobileBalanceDisplay: document.getElementById('mobile-balance-display'),
        vaultDisplayContainer: document.getElementById('vault-display-container'),
        vaultDisplay: document.getElementById('vault-display'),
        
        // Mapeamento dos elementos do jogo, modais, etc. (sem alterações)
        balanceBtn: document.getElementById('balance-btn'),
        bannerTrack: document.querySelector('.banner-carousel-track'),
        bannerSlides: document.querySelectorAll('.banner-slide'),
            bannerDotsContainer: document.querySelector('.banner-dots'),
        winnersTrack: document.querySelector('.winners-carousel-section .carousel-track'),
        latestWinnersList: document.getElementById('latest-winners-list'),
        scratchCards: document.querySelectorAll('.scratch-card'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalContainer: document.getElementById('modal-container'),
        gameModalOverlay: document.getElementById('game-modal-overlay'),
        backToHomeBtn: document.getElementById('back-to-home'),
        gameTitle: document.getElementById('game-title'),
        prizesTrack: document.getElementById('prizes-carousel-track'),
        symbolsGrid: document.getElementById('symbols-grid-underneath'),
        gameCanvas: document.getElementById('scratch-game-canvas'),
        purchaseOverlay: document.getElementById('purchase-overlay'),
        purchasePrice: document.getElementById('purchase-price'),
        purchaseBtn: document.getElementById('purchase-btn'),
        gameResult: document.getElementById('game-result'),
        playAgainGameBtn: document.getElementById('play-again-game'),
        revealAllBtn: document.getElementById('reveal-all-btn'),
        autoPlayBtn: document.getElementById('auto-play-btn'),
        winConfettiCanvas: document.getElementById('win-confetti-canvas'),
        audio: {
            scratch: document.getElementById('audio-scratch'),
            reveal: document.getElementById('audio-reveal'),
            nearMiss: document.getElementById('audio-near-miss'), 
            win: document.getElementById('audio-win'),
        }
    };
    
    const gameCanvasContext = Elements.gameCanvas.getContext('2d');

    /**
     * Utilitários (Utils)
     * Funções de ajuda reutilizáveis.
     */
    const Utils = {
        playSound: (soundElement) => {
            if (soundElement) {
                soundElement.currentTime = 0;
                soundElement.play().catch(e => console.error("Erro ao tocar áudio:", e));
            }
        },
        formatCurrency: (value) => {
            return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
        },
        validateCPF: (cpf) => {
            // A sua função de validação de CPF permanece aqui
            cpf = String(cpf).replace(/[^\d]+/g, '');
            if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
            let add = 0;
            for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
            let rev = 11 - (add % 11);
            if (rev === 10 || rev === 11) rev = 0;
            if (rev !== parseInt(cpf.charAt(9))) return false;
            add = 0;
            for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
            rev = 11 - (add % 11);
            if (rev === 10 || rev === 11) rev = 0;
            if (rev !== parseInt(cpf.charAt(10))) return false;
            return true;
        }
    };

    /**
     * Módulo da API
     * Responsável por toda a comunicação com o backend.
     */
    const API = {
        request: async (endpoint, method = 'GET', body = null) => {
            const headers = { 'Content-Type': 'application/json' };
            if (State.token) {
                headers['Authorization'] = `Bearer ${State.token}`;
            }
            try {
                const response = await fetch(`${Config.API_URL}${endpoint}`, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : null
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: response.statusText }));
                    if (response.status === 401 || response.status === 403) Auth.logout();
                    throw new Error(errorData.message || 'Erro no servidor.');
                }
                // O backend pode não retornar JSON em alguns casos (ex: 204 No Content), então tratamos isso
                const text = await response.text();
                return text ? JSON.parse(text) : {};
            } catch (error) {
                console.error(`API Error on ${endpoint}:`, error);
                UI.showToast(error.message, 'error');
                return null;
            }
        },
        login: (email, password) => API.request('/api/auth/login', 'POST', { email, password }),
        register: (payload) => API.request('/api/auth/register', 'POST', payload),
        getProfile: () => API.request('/api/user/profile'),
        playGame: (price) => API.request('/api/game/play', 'POST', { price }),
        createPix: (amount) => API.request('/api/deposit/create-pix', 'POST', { amount }),
        requestWithdraw: () => API.request('/api/user/request-withdraw', 'POST'),
        applyCoupon: (couponCode) => API.request('/api/user/apply-coupon', 'POST', { couponCode })
    };
    
    /**
     * Módulo de Autenticação (Auth)
     * Lida com o fluxo de autenticação do utilizador.
     */
    const Auth = {
        login: async (email, password, buttonElement) => {
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;

            try {
                const data = await API.login(email, password);
                if (data && data.token) {
                    Auth.setSession(data.token, data.user);
                    UI.closeModal();
                }
            } finally {
                buttonElement.classList.remove('loading');
                buttonElement.disabled = false;
            }
        },

        register: async (username, email, password, cpf, phone, buttonElement) => {
            if (!Utils.validateCPF(cpf)) {
                UI.showToast("CPF inválido. Por favor, verifique os dados.", 'error');
                return;
            }
            
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;

            try {
                const referralCode = localStorage.getItem('referralCode');
                const payload = { username, email, password, cpf, phone, referralCode };
                const data = await API.register(payload);

                if (data && data.token) {
                    Auth.setSession(data.token, data.user);
                    localStorage.removeItem('referralCode');
                    UI.closeModal();
                    UI.showToast(`Bem-vindo(a), ${data.user.username}! A sua conta foi criada com sucesso.`);
                }
            } finally {
                buttonElement.classList.remove('loading');
                buttonElement.disabled = false;
            }
        },
        logout: () => {
            State.user = null;
            State.token = null;
            localStorage.removeItem('authToken');
            if (State.socket) State.socket.close();
            UI.updateForAuthState();
            window.location.reload();
        },
        setSession: (token, user) => {
            State.token = token;
            State.user = user;
            localStorage.setItem('authToken', token);
            WebSocketService.connect(token);
            UI.updateForAuthState();
        },
        checkStatus: async () => {
            if (State.token) {
                const userProfile = await API.getProfile();
                if (userProfile) {
                    Auth.setSession(State.token, userProfile);
                } else {
                    Auth.logout();
                }
            } else {
                UI.updateForAuthState();
            }
        },
        handleReferralCode: () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const referralCode = urlParams.get('ref');
                if (referralCode) {
                    localStorage.setItem('referralCode', referralCode);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) {
                console.error("Erro ao processar código de referência:", e);
            }
        }
    };

    /**
     * Módulo de Interface do Utilizador (UI)
     * Controla todas as manipulações do DOM e a apresentação visual.
     */
    const UI = {
        // --- Funções Principais de UI ---

        showToast: (message, type = 'info') => {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        },

        updateBalanceDisplay: () => {
            const user = State.user;
            const balance = user ? user.balance : 0.00;
            const vaultBalance = user ? user.bonus_vault_balance : 0.00;

            // Atualiza o texto dos saldos
            if (Elements.balanceDisplay) Elements.balanceDisplay.innerText = Utils.formatCurrency(balance);
            if (Elements.mobileBalanceDisplay) Elements.mobileBalanceDisplay.innerText = Utils.formatCurrency(balance);
            if (Elements.vaultDisplay) Elements.vaultDisplay.innerText = Utils.formatCurrency(vaultBalance);
            if (Elements.mobileVaultDisplay) Elements.mobileVaultDisplay.innerText = Utils.formatCurrency(vaultBalance);
            
            // Controla o ESTADO VISUAL do Cofre
            const vaultContainer = Elements.vaultDisplayContainer;
            const mobileVaultContainer = Elements.mobileVaultDisplayContainer;

            if (vaultBalance > 0) {
                // Adiciona a classe .active para o fazer brilhar
                vaultContainer?.classList.add('active');
                mobileVaultContainer?.classList.add('active');
            } else {
                // Remove a classe .active para o deixar no estado normal/inativo
                vaultContainer?.classList.remove('active');
                mobileVaultContainer?.classList.remove('active');
            }
        },
        updateForAuthState: () => {
            const loginBtnDesktop = document.querySelector('.main-nav a[data-action="login"]');
            const loginBtnMobile = document.querySelector('.mobile-nav a[data-action="login"]');
            const withdrawBtnDesktop = document.querySelector('.main-nav a[data-action="withdraw"]');
            
            const couponBtnDesktop = document.querySelector('.main-nav a[data-action="coupon"]');
            const couponBtnMobile = document.querySelector('.mobile-nav a[data-action="coupon"]');

            if (State.user) {
                const userName = State.user.username;
                if (loginBtnDesktop) {
                    loginBtnDesktop.innerHTML = `<i class="fas fa-user"></i> ${userName}`;
                    loginBtnDesktop.dataset.action = 'profile';
                }
                if (loginBtnMobile) {
                    loginBtnMobile.querySelector('span').innerText = userName;
                    loginBtnMobile.dataset.action = 'profile';
                }
                if(withdrawBtnDesktop) withdrawBtnDesktop.style.display = 'inline-flex';

                if (State.user.affiliate_id) {
                    if(couponBtnDesktop) couponBtnDesktop.style.display = 'none';
                    if(couponBtnMobile) couponBtnMobile.style.display = 'none';
                } else {
                    if(couponBtnDesktop) couponBtnDesktop.style.display = 'inline-flex';
                    if(couponBtnMobile) couponBtnMobile.style.display = 'flex';
                }

            } else {
                if (loginBtnDesktop) {
                    loginBtnDesktop.innerHTML = `<i class="fas fa-user"></i> Login`;
                    loginBtnDesktop.dataset.action = 'login';
                }
                if (loginBtnMobile) {
                    loginBtnMobile.querySelector('span').innerText = 'Login';
                    loginBtnMobile.dataset.action = 'login';
                }
                if(withdrawBtnDesktop) withdrawBtnDesktop.style.display = 'none';
                if(couponBtnDesktop) couponBtnDesktop.style.display = 'none';
                if(couponBtnMobile) couponBtnMobile.style.display = 'none';
            }
            UI.updateBalanceDisplay();
        },

        handleInsufficientBalance: () => {
            const balanceBtn = Elements.balanceBtn || Elements.mobileBalanceDisplay.parentElement;
            if (balanceBtn) {
                balanceBtn.classList.add('shake');
                setTimeout(() => balanceBtn.classList.remove('shake'), 820);
            }
        },

        // --- Funções de Modal ---

        openModal: (content, onOpen = () => {}) => {
            Elements.modalContainer.innerHTML = content;
            Elements.modalOverlay.classList.remove('hidden');
            setTimeout(onOpen, 0);
        },

        closeModal: () => {
            Elements.modalOverlay.classList.add('hidden');
            Elements.modalContainer.innerHTML = '';
        },

        

        showLoginModal: (activeTab = 'login') => {
            const content = `
                <div class="auth-modal-header"><h2 class="logo">Raspa da Sorte</h2></div>
                <div class="modal-body">
                    <div class="auth-tabs">
                        <button class="auth-tab" data-form="login">Login</button>
                        <button class="auth-tab" data-form="register">Criar Conta</button>
                    </div>
                    <div class="auth-form-container">
                        <form id="login-form">
                            <div class="form-group"><label for="login-email">E-mail</label><input type="email" id="login-email" required></div>
                            <div class="form-group"><label for="login-password">Senha</label><input type="password" id="login-password" required></div>
                            <button type="submit" class="btn btn-primary">Entrar</button>
                        </form>
                        <form id="register-form">
                            <div class="form-group"><label for="register-username">Nome de Usuário</label><input type="text" id="register-username" required></div>
                            <div class="form-group"><label for="register-email">E-mail</label><input type="email" id="register-email" required></div>
                            <div class="form-group"><label for="register-cpf">CPF</label><input type="text" id="register-cpf" placeholder="000.000.000-00" required></div>
                            <div class="form-group"><label for="register-phone">Telefone</label><input type="tel" id="register-phone" placeholder="(00) 90000-0000" required></div>
                            <div class="form-group"><label for="register-password">Senha</label><input type="password" id="register-password" minlength="6" required></div>
                            <button type="submit" class="btn btn-primary">Criar Conta</button>
                        </form>
                    </div>
                </div>`;
            UI.openModal(content, () => {
                const tabs = document.querySelectorAll('.auth-tab');
                const forms = document.querySelectorAll('.auth-form-container form');
                const switchTab = (targetTab) => {
                    tabs.forEach(tab => tab.classList.remove('active'));
                    forms.forEach(form => form.classList.remove('active'));
                    document.querySelector(`.auth-tab[data-form="${targetTab}"]`).classList.add('active');
                    document.getElementById(`${targetTab}-form`).classList.add('active');
                };
                tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.form)));
                switchTab(activeTab);
                
                document.getElementById('login-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    Auth.login(document.getElementById('login-email').value, document.getElementById('login-password').value, e.submitter);
                });
                
                document.getElementById('register-form').addEventListener('submit', (e) => { 
                    e.preventDefault(); 
                    Auth.register(
                        document.getElementById('register-username').value, 
                        document.getElementById('register-email').value, 
                        document.getElementById('register-password').value,
                        document.getElementById('register-cpf').value,
                        document.getElementById('register-phone').value,
                        e.submitter
                    ); 
                });
            });
        },

        showProfileModal: () => {
            if (!State.user) { UI.showLoginModal(); return; }
            const content = `
                <div class="profile-modal">
                    <button class="modal-close-btn">&times;</button>
                    <h3>Olá, ${State.user.username}!</h3>
                    <div class="profile-info">
                        <div class="info-item"><span>Saldo Real</span><strong>${Utils.formatCurrency(State.user.balance)}</strong></div>
                        <div class="info-item"><span>Saldo Sacável</span><strong>${Utils.formatCurrency(State.user.withdrawable_balance)}</strong></div>
                        <div class="info-item"><span>E-mail</span><strong>${State.user.email}</strong></div>
                    </div>
                    <div class="profile-modal-actions">
                        <button id="logout-btn" class="btn btn-danger">Sair da Conta</button>
                        <button id="close-profile-btn" class="btn btn-outline">Continuar Jogando</button>
                    </div>
                </div>`;
            UI.openModal(content, () => {
                Elements.modalContainer.querySelector('.modal-close-btn').addEventListener('click', UI.closeModal);
                document.getElementById('logout-btn').addEventListener('click', Auth.logout);
                document.getElementById('close-profile-btn').addEventListener('click', UI.closeModal);
            });
        },

        showCouponModal: () => {
            const content = `
                <div>
                    <button class="modal-close-btn">&times;</button>
                    <h3>Cupom</h3>
                    <p>Insira o código do seu afiliado para receber um bónus especial!</p>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <input type="text" id="coupon-code-input" placeholder="Digite seu cupom aqui">
                    </div>
                    <button id="apply-coupon-btn" class="btn btn-primary" style="width: 100%;">Aplicar Cupom</button>
                </div>`;

            UI.openModal(content, () => {
                Elements.modalContainer.querySelector('.modal-close-btn').addEventListener('click', UI.closeModal);
                document.getElementById('apply-coupon-btn').addEventListener('click', async (e) => {
                    const couponCode = document.getElementById('coupon-code-input').value;
                    const buttonElement = e.currentTarget;
                    
                    if (!couponCode) {
                        alert('Por favor, insira um código de cupom.');
                        return;
                    }

                    buttonElement.classList.add('loading');
                    buttonElement.disabled = true;

                    try {
                        const result = await API.applyCoupon(couponCode);
                        if (result) {
                            alert(result.message);
                            const userProfile = await API.getProfile();
                            if(userProfile) Auth.setSession(State.token, userProfile);
                            UI.closeModal();
                        }
                    } finally {
                        buttonElement.classList.remove('loading');
                        buttonElement.disabled = false;
                    }
                });
            });
        },

        showDepositModal: () => {
            const content = `
                <div class="deposit-modal">
                    <button class="modal-close-btn">&times;</button>
                    <h3>Depositar</h3>
                    <p>Escolha um valor ou digite abaixo:</p>
                    <div class="deposit-presets">
                        <button class="preset-btn" data-amount="0.15">R$ 0.15</button>
                        <button class="preset-btn active" data-amount="30">R$ 30</button>
                        <button class="preset-btn" data-amount="50">R$ 50</button>
                        <button class="preset-btn" data-amount="100">R$ 100</button>
                    </div>
                    <input type="number" id="deposit-amount-input" class="deposit-input" value="30" min="1">
                    <button id="generate-qr-btn" class="btn btn-primary">Gerar QR Code PIX</button>
                </div>`;
            UI.openModal(content, () => {
                Elements.modalContainer.querySelector('.modal-close-btn').addEventListener('click', UI.closeModal);
                const amountInput = document.getElementById('deposit-amount-input');
                document.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.querySelector('.preset-btn.active')?.classList.remove('active');
                        btn.classList.add('active');
                        amountInput.value = btn.dataset.amount;
                    });
                });
                amountInput.addEventListener('input', () => {
                    document.querySelector('.preset-btn.active')?.classList.remove('active');
                });
                document.getElementById('generate-qr-btn').addEventListener('click', async () => {
                    const amount = document.getElementById('deposit-amount-input').value;
                    const generateBtn = document.getElementById('generate-qr-btn');
                    generateBtn.innerText = 'Gerando...';
                    generateBtn.disabled = true;
                    
                    const pixData = await API.createPix(amount);
                    
                    if (pixData && pixData.success) {
                        UI.showQrCodeModal(pixData.qrCodeText, pixData.expiresIn);
                    } else {
                        generateBtn.innerText = 'Gerar QR Code PIX';
                        generateBtn.disabled = false;
                    }
                });
            });
        },

        showVaultIntroModal: (amount) => {
            const content = `
                <div class="unlock-vault-modal" style="text-align: center;">
                    <i class="fas fa-treasure-chest" style="font-size: 5rem; color: var(--prize-gold); margin-bottom: 1rem;"></i>
                    <h3>VOCÊ INAUGUROU SEU COFRE!</h3>
                    <p>Sua grande vitória inaugurou um Cofre de Prémios pessoal!</p>
                    <div class="vault-status">
                        <div class="vault-status-label">PRÊMIOS ACUMULADOS</div>
                        <div class="vault-status-amount">${Utils.formatCurrency(amount)}</div>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-dark);">Continue jogando para enchê-lo ainda mais e faça novos depósitos para desbloquear seus prêmios!</p>
                    <button class="btn btn-primary" id="close-vault-intro-btn" style="width: 100%;">Entendi!</button>
                </div>`;
            UI.openModal(content, () => {
                document.getElementById('close-vault-intro-btn').addEventListener('click', UI.closeModal);
            });
        },

        showQrCodeModal: (qrText, expiresIn) => { 
            let timerInterval;
            const startTimer = (duration, timerEl) => {
                let timeLeft = duration;
                timerInterval = setInterval(() => {
                    timeLeft--;
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    if (timerEl) timerEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    if (timeLeft <= 0) {
                        clearInterval(timerInterval);
                        alert("Este PIX expirou. Por favor, gere um novo.");
                        UI.closeModal();
                    }
                }, 1000);
            };
            const content = `
                <div class="pix-modal">
                    <button class="modal-close-btn">&times;</button>
                    <h3>Pagar com PIX</h3>
                    <p>Escaneie o QR Code ou use o Copia e Cola</p>
                    <canvas id="pix-qrcode-canvas" class="pix-qrcode"></canvas>
                    <div class="pix-copy-paste">
                        <input type="text" id="pix-code-text" value="${qrText}" readonly>
                        <button id="copy-pix-btn"><i class="fas fa-copy"></i></button>
                    </div>
                    <p>Expira em: <span id="pix-timer">--:--</span></p>
                    <p class="pix-waiting">Aguardando pagamento...</p>
                </div>`;
            UI.openModal(content, () => {
                Elements.modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => {
                    clearInterval(timerInterval);
                    UI.closeModal();
                });
                
                const qrCanvas = document.getElementById('pix-qrcode-canvas');
                if (qrCanvas) {
                    new QRious({
                        element: qrCanvas,
                        value: qrText,
                        size: 250,
                        padding: 10,
                        level: 'H'
                    });
                }

                startTimer(expiresIn, document.getElementById('pix-timer'));
                document.getElementById('copy-pix-btn').addEventListener('click', () => {
                    navigator.clipboard.writeText(qrText).then(() => UI.showToast('Código PIX copiado!'));
                });
            });
        },

        showPaymentSuccessModal: async (amount) => {
            const content = `
                <div class="success-modal">
                    <i class="fas fa-check-circle success-icon"></i>
                    <h3>Depósito Confirmado!</h3>
                    <p>O valor de ${Utils.formatCurrency(amount)} foi creditado em sua conta.</p>
                    <button id="payment-success-close-btn" class="btn btn-primary">Começar a Jogar!</button>
                </div>`;
            UI.openModal(content, async () => {
                Utils.playSound(Elements.audio.win);
                document.getElementById('payment-success-close-btn').addEventListener('click', UI.closeModal);
                // Atualiza o perfil para refletir o novo saldo
                const userProfile = await API.getProfile();
                if (userProfile) {
                    State.user = userProfile;
                    UI.updateForAuthState();
                }
            });
        },

        // Substitua esta função no Módulo UI
        showWithdrawModal: async () => {
            // A função de saque agora também serve para ver o estado do cofre
            const vaultData = await API.requestWithdraw();
            if (!vaultData) return;

            // Cenário 1: O jogador tem saldo sacável
            if (vaultData.status === 'ready_to_withdraw') {
                const content = `
                    <div class="confirmation-modal">
                        <button class="modal-close-btn">&times;</button>
                        <h4>Saque Disponível</h4>
                        <p>Você tem <strong>${Utils.formatCurrency(vaultData.amount)}</strong> disponíveis para sacar. Insira sua chave PIX.</p>
                        <input type="text" id="pix-key-input" class="deposit-input" placeholder="Sua chave PIX">
                        <button class="btn btn-primary" style="width: 100%;">Sacar Agora</button>
                    </div>`;
                UI.openModal(content, () => {
                    Elements.modalContainer.querySelector('.modal-close-btn').addEventListener('click', UI.closeModal);
                });
                return;
            }
            
            // Cenário 2: O jogador tem prêmios no cofre para desbloquear
            if (vaultData.status === 'unlock_vault_prompt') {
                const offersHtml = (vaultData.offers || []).map(offer => `
                    <div class="unlock-offer ${offer.isVip ? 'vip' : ''}">
                        <div class="offer-details">
                            <h4>${offer.title}</h4>
                            <p>${offer.description} <span class="bonus-text">${offer.bonusText || ''}</span></p>
                        </div>
                        <button class="btn btn-primary" data-amount="${offer.amount}">${Utils.formatCurrency(offer.amount)}</button>
                    </div>
                `).join('');

                const content = `
                    <div class="unlock-vault-modal">
                        <button class="modal-close-btn">&times;</button>
                        <div class="vault-modal-content">
                            <img src="image/cofre.png" alt="Cofre de Prêmios" class="vault-modal-image">
                            <div class="vault-modal-amount">${Utils.formatCurrency(vaultData.vaultBalance)}</div>
                        </div>
                        <div class="unlock-offers">${offersHtml}</div>
                    </div>`;
                    
                UI.openModal(content, () => {
                    Elements.modalContainer.querySelector('.modal-close-btn').addEventListener('click', UI.closeModal);
                    document.querySelectorAll('.unlock-offer .btn-primary').forEach(btn => {
                        btn.addEventListener('click', () => {
                            UI.closeModal();
                            UI.showDepositModal();
                            setTimeout(() => {
                                document.getElementById('deposit-amount-input').value = btn.dataset.amount;
                                const presetBtn = document.querySelector(`.preset-btn[data-amount="${btn.dataset.amount}"]`);
                                if (presetBtn) {
                                    document.querySelector('.preset-btn.active')?.classList.remove('active');
                                    presetBtn.classList.add('active');
                                }
                            }, 100);
                        });
                    });
                });
                return;
            }
            
            // Cenário 3: Nenhum dos anteriores
            UI.showToast(vaultData.message || 'Não há saldo sacável ou prêmios no cofre.', 'info');
        },

        // --- Funções de Animação e Carrossel ---
        triggerWinAnimation: () => {
            if (typeof confetti === 'undefined') return;
            const myConfetti = confetti.create(Elements.winConfettiCanvas, { resize: true, useWorker: true });
            const duration = 2 * 1000;
            const end = Date.now() + duration;
            (function frame() {
                myConfetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#00ff7f', '#ffffff', '#FFD700'] });
                myConfetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#00ff7f', '#ffffff', '#FFD700'] });
                if (Date.now() < end) { requestAnimationFrame(frame); }
            }());
        },
        
        generateWinnersCarousel: () => {
        if (!Elements.winnersTrack) {
            console.warn("Elemento do carrossel de ganhadores não encontrado.");
            return;
        }

        const winners = [
            { name: 'Ricardo Almeida', prizeValue: 'R$ 250,00', gameName: 'na Febre do Ouro', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Juliana Costa', prizeValue: 'iPhone 15', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/ffffff/000000?text=📱', isBigPrize: true },
            { name: 'Fernando Martins', prizeValue: 'R$ 50,00', gameName: 'no Prêmio Relâmpago', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Camila Gonçalves', prizeValue: 'PIX de R$ 5.000', gameName: 'na Mina de Diamantes', icon: 'https://placehold.co/50x50/32CD32/000000?text=PIX', isBigPrize: true },
            { name: 'Leandro Pereira', prizeValue: 'R$ 100,00', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Beatriz Lima', prizeValue: 'R$ 7.500,00', gameName: 'na Mina de Diamantes', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24', isBigPrize: true },
            { name: 'Gustavo Nogueira', prizeValue: 'R$ 20,00', gameName: 'no Prêmio Relâmpago', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Patrícia Azevedo', prizeValue: 'R$ 500,00', gameName: 'na Febre do Ouro', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Marcelo Barbosa', prizeValue: 'Playstation 5', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/ffffff/000000?text=PS5', isBigPrize: true },
            { name: 'Sandra Monteiro', prizeValue: 'R$ 10,00', gameName: 'no Prêmio Relâmpago', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Thiago Farias', prizeValue: 'R$ 1.000,00', gameName: 'no Prêmio Relâmpago', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Vanessa Rocha', prizeValue: 'R$ 150,00', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Rodrigo Medeiros', prizeValue: 'Macbook Pro', gameName: 'na Mina de Diamantes', icon: 'https://placehold.co/50x50/ffffff/000000?text=💻', isBigPrize: true },
            { name: 'Aline Cunha', prizeValue: 'R$ 300,00', gameName: 'na Febre do Ouro', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Felipe Dias', prizeValue: 'R$ 75,00', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Carla Vieira', prizeValue: 'R$ 5.000,00', gameName: 'no Cofre Premiado', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24', isBigPrize: true },
            { name: 'Bruno Pires', prizeValue: 'R$ 25,00', gameName: 'no Prêmio Relâmpago', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' },
            { name: 'Débora Castro', prizeValue: 'R$ 2.500,00', gameName: 'na Febre do Ouro', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24', isBigPrize: true },
            { name: 'Lucas Santos', prizeValue: 'Volkswagen Nivus', gameName: 'no Destino Milionário', icon: 'https://placehold.co/50x50/ffffff/000000?text=🚗', isBigPrize: true },
            { name: 'Isabela Teixeira', prizeValue: 'R$ 1.500,00', gameName: 'na Mina de Diamantes', icon: 'https://placehold.co/50x50/1a1a1a/DAA520?text=R%24' }
        ];

        const fullTrack = [...winners, ...winners];
        Elements.winnersTrack.innerHTML = fullTrack.map(winner => `
            <div class="winner-card ${winner.isBigPrize ? 'big-prize' : ''}">
                <div class="winner-icon"><img src="${winner.icon}" alt="Prêmio"></div>
                <div class="winner-info">
                    <p class="name">${winner.name} ganhou</p>
                    <p class="prize-value">${winner.prizeValue}</p>
                    <p class="prize-name">${winner.gameName}</p>
                </div>
            </div>
        `).join('');

        const numItems = winners.length;
        const speedMultiplier = 2.3;
        const duration = numItems * speedMultiplier;
        
        const scrollWidth = Elements.winnersTrack.scrollWidth / 2;
        const animationName = 'dynamicScroll';
        const oldStyle = document.getElementById('carousel-animation-style');
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = 'carousel-animation-style';
        style.innerHTML = `
            @keyframes ${animationName} {
                from { transform: translateX(0); }
                to { transform: translateX(-${scrollWidth}px); }
            }
        `;
        document.head.appendChild(style);
        Elements.winnersTrack.style.animation = `${animationName} ${duration}s linear infinite`;
    },

        generateLatestWinnersList: () => {
            const testimonialContainer = Elements.latestWinnersList;
            if (!testimonialContainer) {
                console.warn("Elemento da seção de depoimentos não encontrado.");
                return;
            }

            const testimonials = [
                {
                    name: 'Dona Ana',
                    photo: 'https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
                    quote: '“Joguei no Cofre Premiado e ganhei! Consegui finalmente pagar todas as minhas contas. Estou muito aliviada e feliz!”'
                },
                {
                    name: 'Carlos Silva',
                    photo: 'https://images.pexels.com/photos/837358/pexels-photo-837358.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
                    quote: '“Ganhei R$ 5.000,00 na Febre do Ouro! Com o prêmio, dei entrada no meu primeiro carro. Inacreditável!”'
                },
                {
                    name: 'Juliana & Marcos',
                    photo: 'https://images.pexels.com/photos/1193333/pexels-photo-1193333.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
                    quote: '“Sempre jogamos juntos. Ganhamos um prêmio que vai nos ajudar a fazer a viagem dos nossos sonhos. Gratidão!”'
                },
                {
                    name: 'Ricardo Lima',
                    photo: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
                    quote: '“Nunca pensei que ganharia. O prêmio veio em boa hora e me ajudou a investir no meu pequeno negócio.”'
                },
                {
                    name: 'Fernanda Costa',
                    photo: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
                    quote: '“Ganhei um prêmio incrível na Mina de Diamantes! Uma emoção que não consigo descrever. Recomendo a todos!”'
                }
            ];

            const fullTrackData = [...testimonials, ...testimonials];

            testimonialContainer.innerHTML = `
                <div class="testimonial-carousel-container">
                    <div class="testimonial-carousel-track">
                        ${fullTrackData.map(testimonial => `
                            <div class="testimonial-card" style="background-image: url('${testimonial.photo}')">
                                <div class="testimonial-card-content">
                                    <h4>${testimonial.name}</h4>
                                    <p>${testimonial.quote}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            const track = testimonialContainer.querySelector('.testimonial-carousel-track');
            const numItems = testimonials.length;
            const duration = numItems * 8;
            const scrollWidth = track.scrollWidth / 2;
            const animationName = 'testimonialScroll';

            const oldStyle = document.getElementById('testimonial-animation-style');
            if (oldStyle) oldStyle.remove();

            const style = document.createElement('style');
            style.id = 'testimonial-animation-style';
            style.innerHTML = `
                @keyframes ${animationName} {
                    from { transform: translateX(0); }
                    to { transform: translateX(-${scrollWidth}px); }
                }
            `;
            document.head.appendChild(style);
            track.style.animation = `${animationName} ${duration}s linear infinite`;
        }
    };

    /**
     * Módulo de Jogo (GameHandler)
     * Gere o estado da interface do jogo e exibe os resultados do backend.
     */
    let autoPlayInterval = null;
    let isAutoPlaying = false;

    const GameHandler = {
        open: (cardElement) => {
            if (!State.user) {
                UI.showLoginModal();
                return;
            }
            State.currentCardData = {
                id: cardElement.id,
                price: parseFloat(cardElement.dataset.price),
                prizes: JSON.parse(cardElement.dataset.prizes),
                title: cardElement.querySelector('h3').innerText
            };
            GameHandler.setupGamePage(true); // Bloqueia o jogo inicialmente
            Elements.gameModalOverlay.classList.remove('hidden');
        },
        setupGamePage: (isLocked) => {
            Elements.gameTitle.innerText = State.currentCardData.title;
            Elements.playAgainGameBtn.classList.add('hidden');
            Elements.gameResult.classList.remove('win');
            Elements.revealAllBtn.classList.add('hidden');
            State.isCardPurchased = false;
            
            if (isLocked) {
                Elements.gameResult.innerText = 'Clique em "Comprar" para iniciar';
                Elements.purchasePrice.innerText = Utils.formatCurrency(State.currentCardData.price);
                Elements.purchaseOverlay.classList.remove('hidden');
                Elements.symbolsGrid.innerHTML = ''; // Limpa a grelha anterior
                GameHandler.setupScratchCanvas(true);
            }
        },
        purchaseCard: async () => {
            if (!State.user) { UI.showLoginModal(); return; }
            const price = State.currentCardData.price;
            if (parseFloat(State.user.balance) < price) {
                UI.handleInsufficientBalance();
                UI.showDepositModal();
                return;
            }
            Elements.purchaseBtn.classList.add('loading');
            Elements.purchaseBtn.disabled = true;
            Elements.gameResult.innerText = 'Boa sorte!';

            const gameData = await API.playGame(price);
            
            Elements.purchaseBtn.classList.remove('loading');
            Elements.purchaseBtn.disabled = false;

            if (gameData && gameData.success) {
                // Atualiza o estado local com os novos saldos do backend
                State.user.balance = gameData.newBalance;
                State.user.bonus_vault_balance = gameData.newBonusVaultBalance;
                State.user.withdrawable_balance = gameData.withdrawable_balance;
                
                UI.updateBalanceDisplay(); // Atualiza a UI com os novos saldos
                State.isCardPurchased = true;
                GameHandler.displayBackendResult(gameData);
            } else {
                GameHandler.setupGamePage(true);
            }
        },
        displayBackendResult: (outcome) => {
            Elements.purchaseOverlay.classList.add('hidden');
            Elements.gameResult.innerText = 'Clique em "Revelar Tudo" para ver o resultado!';
            
            const symbolsMap = {
                "gem": "image/symbols/gem.png",
                "money-bag": "image/symbols/money-bag.png",
                "bell": "image/symbols/bell.png",
                "clover": "image/symbols/clover.png",
                "cherries": "image/symbols/cherries.png",
                "lemon": "image/symbols/lemon.png",
                "star": "image/symbols/star.png",
            };

            // Limpa a grelha e preenche com os novos símbolos
            Elements.symbolsGrid.innerHTML = '';
            outcome.gridSymbols.forEach(symbolKey => {
                const cell = document.createElement('div');
                cell.classList.add('symbol-cell');
                
                const img = document.createElement('img');
                img.src = symbolsMap[symbolKey] || ''; 
                img.alt = symbolKey;
                
                cell.appendChild(img);
                Elements.symbolsGrid.appendChild(cell);
            });
            
            Elements.gameCanvas.dataset.outcome = JSON.stringify(outcome);
            GameHandler.setupScratchCanvas(false);

            Elements.revealAllBtn.classList.remove('hidden');
        },
        revealCard: () => {
            if (!State.isCardPurchased) return;
            
            State.isDrawing = false;
            Utils.playSound(Elements.audio.reveal);
            Elements.gameCanvas.classList.add('revealing');
            
            // ESCONDE O BOTÃO "REVELAR TUDO" APÓS O USO
            Elements.revealAllBtn.classList.add('hidden');
            
            setTimeout(() => {
                State.isGameActive = false;
                GameHandler.showFinalResult();
                Elements.gameCanvas.classList.remove('revealing');
            }, 500);
        },

        toggleAutoPlay: async () => {
            if (isAutoPlaying) {
                // Se já estiver a jogar, para o ciclo
                isAutoPlaying = false;
                clearInterval(autoPlayInterval);
                Elements.autoPlayBtn.innerHTML = '<i class="fas fa-redo-alt"></i> Rodadas Automáticas';
                Elements.autoPlayBtn.classList.remove('auto-playing');
                console.log("Jogo automático parado.");
                return;
            }

            isAutoPlaying = true;
            Elements.autoPlayBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Parar Automático';
            Elements.autoPlayBtn.classList.add('auto-playing');
            console.log("Jogo automático iniciado.");

            const playRound = async () => {
                if (!isAutoPlaying) return; // Para a execução se o utilizador clicou em "Parar"

                // 1. Verifica se pode comprar o card
                if (parseFloat(State.user.balance) < State.currentCardData.price) {
                    UI.showToast("Saldo insuficiente para continuar o jogo automático.", "error");
                    GameHandler.toggleAutoPlay(); // Para o ciclo
                    return;
                }

                // 2. Compra e joga
                console.log("Auto-play: Comprando novo card...");
                await GameHandler.purchaseCard();

                // 3. Espera um pouco e revela o resultado
                await new Promise(resolve => setTimeout(resolve, 1500)); // Espera 1.5s
                if (!isAutoPlaying) return;
                
                console.log("Auto-play: Revelando resultado...");
                GameHandler.revealCard();

                // 4. Espera mais um pouco e prepara o próximo jogo
                await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s
                if (!isAutoPlaying) return;

                console.log("Auto-play: Preparando próximo jogo...");
                GameHandler.setupGamePage(true);
            };

            // Inicia a primeira rodada imediatamente
            playRound(); 
            // Define o intervalo para as próximas rodadas
            autoPlayInterval = setInterval(playRound, 4000); // Próxima rodada a cada 4 segundos
        },

        showFinalResult: () => {
            const outcome = JSON.parse(Elements.gameCanvas.dataset.outcome);
            Elements.playAgainGameBtn.classList.remove('pulse-encouragement');
            
            if (outcome.isWinner) {
                const prizeValue = outcome.winningPrize.value;
                Elements.gameResult.innerText = `PARABÉNS! Você ganhou ${Utils.formatCurrency(prizeValue)} no Cofre!`;
                Elements.gameResult.classList.add('win');
                Utils.playSound(Elements.audio.win);
                UI.triggerWinAnimation();

                // CONDIÇÃO CRÍTICA: Se esta foi a vitória "Hook" que inaugurou o cofre...
                const wasFirstBigWin = (State.user.bonus_vault_balance === prizeValue) && (prizeValue >= 100);
                if (wasFirstBigWin) {
                    // ...chama o novo modal de celebração!
                    setTimeout(() => {
                        UI.showVaultIntroModal(prizeValue);
                    }, 1500); // Espera 1.5s para o jogador absorver a vitória
                }

            } else {
                Elements.gameResult.innerText = 'Não foi desta vez. Tente novamente!';
            }
            
            gameCanvasContext.clearRect(0, 0, Elements.gameCanvas.width, Elements.gameCanvas.height);
            Elements.playAgainGameBtn.classList.remove('hidden');
        },

        setupScratchCanvas: (isLocked) => {
             setTimeout(() => {
                if (!Elements.gameCanvas) return;
                State.isGameActive = !isLocked; // O jogo está ativo se não estiver bloqueado
                Elements.gameCanvas.width = Elements.gameCanvas.clientWidth;
                Elements.gameCanvas.height = Elements.gameCanvas.clientHeight;
                gameCanvasContext.clearRect(0, 0, Elements.gameCanvas.width, Elements.gameCanvas.height);
                const gradient = gameCanvasContext.createLinearGradient(0, 0, Elements.gameCanvas.width, Elements.gameCanvas.height);
                gradient.addColorStop(0, '#333');
                gradient.addColorStop(1, '#444');
                gameCanvasContext.fillStyle = gradient;
                gameCanvasContext.fillRect(0, 0, Elements.gameCanvas.width, Elements.gameCanvas.height);
            }, 100);
        },

        getScratchPosition: (e) => {
            const rect = Elements.gameCanvas.getBoundingClientRect();
            const scaleX = Elements.gameCanvas.width / rect.width;
            const scaleY = Elements.gameCanvas.height / rect.height;
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        },

        scratch: (e) => {
            if (!State.isDrawing || !State.isGameActive || !State.isCardPurchased) return;
            e.preventDefault();
            Utils.playSound(Elements.audio.scratch);

            const pos = GameHandler.getScratchPosition(e);
            gameCanvasContext.globalCompositeOperation = 'destination-out';
            gameCanvasContext.beginPath();
            gameCanvasContext.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);
            gameCanvasContext.fill();

            // Lógica puramente visual de "quase ganho" (near miss)
            const outcome = JSON.parse(Elements.gameCanvas.dataset.outcome);
            const col = Math.floor(pos.x / (Elements.gameCanvas.width / 3));
            const row = Math.floor(pos.y / (Elements.gameCanvas.height / 3));
            const index = row * 3 + col;
            
            // Esta lógica foi simplificada pois o backend já define a vitória.
            // O frontend agora apenas reage visualmente.
            GameHandler.checkForNearMiss(outcome, index);
        },

        checkForNearMiss: (outcome, revealedIndex) => {
            const revealedSymbols = State.revealedSymbols || {};
            const symbolKey = outcome.gridSymbols[revealedIndex];

            if (symbolKey && !revealedSymbols[revealedIndex]) {
                revealedSymbols[revealedIndex] = symbolKey;
                State.revealedSymbols = revealedSymbols;

                const counts = {};
                Object.values(revealedSymbols).forEach(symbol => {
                    counts[symbol] = (counts[symbol] || 0) + 1;
                });

                if (!State.nearMissTriggered) {
                    for (const symbol in counts) {
                        if (counts[symbol] === 2) {
                            State.nearMissTriggered = true;
                            Utils.playSound(Elements.audio.nearMiss);
                            const cells = Elements.symbolsGrid.querySelectorAll('.symbol-cell');
                            cells.forEach((cell, i) => {
                                if (outcome.gridSymbols[i] === symbol) {
                                    cell.classList.add('highlight');
                                }
                            });
                            Elements.playAgainGameBtn.classList.add('pulse-encouragement');
                            break; 
                        }
                    }
                }
            }
        }
    };

    /**
     * Módulo do Carrossel de Banners
     * Controla a lógica do carrossel principal.
     */
    const BannerCarousel = {
        currentIndex: 0,
        slideInterval: null,
        totalSlides: 0,

        init: () => {
            if (!Elements.bannerTrack || Elements.bannerSlides.length === 0) return;

            BannerCarousel.totalSlides = Elements.bannerSlides.length;
            BannerCarousel.createDots();
            BannerCarousel.updateCarousel();
            BannerCarousel.startAutoPlay();

            Elements.bannerDotsContainer.addEventListener('click', (e) => {
                if (e.target.matches('.banner-dot')) {
                    const index = parseInt(e.target.dataset.index);
                    BannerCarousel.goToSlide(index);
                    BannerCarousel.resetAutoPlay();
                }
            });
        },

        createDots: () => {
            Elements.bannerDotsContainer.innerHTML = '';
            for (let i = 0; i < BannerCarousel.totalSlides; i++) {
                const dot = document.createElement('button');
                dot.classList.add('banner-dot');
                dot.dataset.index = i;
                Elements.bannerDotsContainer.appendChild(dot);
            }
        },

        updateCarousel: () => {
            if (!Elements.bannerTrack) return;
            Elements.bannerTrack.style.transform = `translateX(-${BannerCarousel.currentIndex * 100}%)`;

            const dots = document.querySelectorAll('.banner-dot');
            dots.forEach(dot => dot.classList.remove('active'));
            if (dots[BannerCarousel.currentIndex]) {
                dots[BannerCarousel.currentIndex].classList.add('active');
            }
        },

        goToSlide: (index) => {
            BannerCarousel.currentIndex = index;
            BannerCarousel.updateCarousel();
        },

        nextSlide: () => {
            BannerCarousel.currentIndex = (BannerCarousel.currentIndex + 1) % BannerCarousel.totalSlides;
            BannerCarousel.updateCarousel();
        },

        startAutoPlay: () => {
            BannerCarousel.slideInterval = setInterval(BannerCarousel.nextSlide, 5000); // Muda a cada 5 segundos
        },

        resetAutoPlay: () => {
            clearInterval(BannerCarousel.slideInterval);
            BannerCarousel.startAutoPlay();
        }
    };
    
    /**
     * Módulo WebSocket
     */
    const WebSocketService = {
        connect: (token) => {
            if (State.socket && State.socket.readyState === WebSocket.OPEN) return;
            
            State.socket = new WebSocket(Config.SOCKET_URL);

            State.socket.onopen = () => {
                console.log('WebSocket Conectado.');
                State.socket.send(JSON.stringify({ type: 'auth', token }));
            };

            State.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'payment_confirmed') {
                        console.log('Pagamento confirmado via WebSocket!', data);
                        UI.showPaymentSuccessModal(data.amount);
                    }
                } catch (error) {
                    console.error("Erro ao processar mensagem do WebSocket:", error);
                }
            };

            State.socket.onclose = () => {
                console.log('WebSocket Desconectado. Tentando reconectar...');
                setTimeout(() => { if (localStorage.getItem('authToken')) WebSocketService.connect(token); }, 5000);
            };
            
            State.socket.onerror = (err) => {
                console.error('Erro no WebSocket:', err);
                State.socket.close();
            };
        }
    };
    
    /**
     * Módulo de Aplicação (App)
     * Ponto de entrada que inicializa a aplicação.
     */
    const App = {
        setupEventListeners: () => {
            Elements.navButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = e.currentTarget.dataset.action;
                    if (!State.user && ['profile', 'deposit', 'withdraw', 'coupon'].includes(action)) {
                        UI.showLoginModal();
                        return;
                    }
                    switch(action) {
                        case 'login': UI.showLoginModal(); break;
                        case 'profile': UI.showProfileModal(); break;
                        case 'deposit': UI.showDepositModal(); break;
                        case 'withdraw': UI.showWithdrawModal(); break; 
                        case 'coupon': UI.showCouponModal(); break;
                    }
                });
            });

            const mobileProfileIcon = document.querySelector('.mobile-profile-icon');
            mobileProfileIcon?.addEventListener('click', (e) => {
                e.preventDefault();
                if (!State.user) {
                    UI.showLoginModal();
                } else {    
                    UI.showProfileModal();
                }
            });

            const vaultContainer = document.getElementById('vault-display-container');
            vaultContainer?.addEventListener('click', (e) => {
                e.preventDefault();
                UI.showWithdrawModal();
            }); 

            const vaultClickHandler = (e) => {
                e.preventDefault();
                UI.showWithdrawModal(); 
            };
            Elements.vaultDisplayContainer?.addEventListener('click', vaultClickHandler);
            Elements.mobileVaultDisplayContainer?.addEventListener('click', vaultClickHandler);

            Elements.scratchCards.forEach(card => {
                card.querySelector('.btn-play').addEventListener('click', () => GameHandler.open(card));
            });
            
            Elements.backToHomeBtn.addEventListener('click', () => Elements.gameModalOverlay.classList.add('hidden'));
            Elements.playAgainGameBtn.addEventListener('click', () => GameHandler.setupGamePage(true));
            Elements.purchaseBtn.addEventListener('click', GameHandler.purchaseCard);
            Elements.revealAllBtn.addEventListener('click', GameHandler.revealCard);
            Elements.autoPlayBtn.addEventListener('click', GameHandler.toggleAutoPlay);
            
            Elements.gameCanvas.addEventListener('mousedown', (e) => { State.isDrawing = true; GameHandler.scratch(e); });
            Elements.gameCanvas.addEventListener('mousemove', GameHandler.scratch);
            Elements.gameCanvas.addEventListener('mouseup', () => { State.isDrawing = false; });
            Elements.gameCanvas.addEventListener('mouseleave', () => { State.isDrawing = false; });
            Elements.gameCanvas.addEventListener('touchstart', (e) => { State.isDrawing = true; GameHandler.scratch(e); }, { passive: false });
            Elements.gameCanvas.addEventListener('touchmove', GameHandler.scratch, { passive: false });
            Elements.gameCanvas.addEventListener('touchend', () => { State.isDrawing = false; });

            Elements.modalOverlay.addEventListener('click', (e) => {
                if (e.target === Elements.modalOverlay) {
                    UI.closeModal();
                }
            });
        },
        init: () => {
            Auth.handleReferralCode();
            Auth.checkStatus();
            UI.generateWinnersCarousel();
            UI.generateLatestWinnersList();
            BannerCarousel.init();
            App.setupEventListeners();
        }
    };

    // Inicia a aplicação
    App.init();
});