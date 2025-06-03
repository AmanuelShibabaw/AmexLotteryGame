// frontend/js/game.js
// Ensure CONFIG, showMessage, getToken, getCurrentUserData, displayUserInfoInHeader are available

let grid = [];
let winningSequence = [];
let revealedSequence = [];
let gameActive = false;
let couponsToFind;
let currentUserData = null; // Will be populated by initializePage

async function initializePage(userData) { // Receives userData from shared.js
    currentUserData = userData; // Store for use in this module
    if (!currentUserData) {
        showMessage("User data not loaded. Please try logging in again.", "error");
        // Potentially redirect or disable game features
        return;
    }

    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.documentElement.style.setProperty('--grid-size', CONFIG.gridSize);
    couponsToFind = CONFIG.couponsInWinningSequence;

    // Load game cost into button text
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.textContent = `Start New Game ($${CONFIG.costPerGameAttempt.toFixed(2)} to play)`;
    }
    
    // Update header with latest balance (already done by shared.js but good to ensure)
    displayUserInfoInHeader(currentUserData);

    loadClientSideGameState(); // Still use this for non-critical UI state
    if (!gameActive) {
        renderPlaceholderGrid();
    }
}

function renderPlaceholderGrid() {
    const gridElement = document.getElementById('lottery-grid');
    gridElement.innerHTML = '';
    for (let r = 0; r < CONFIG.gridSize; r++) {
        for (let c = 0; c < CONFIG.gridSize; c++) {
            const couponDiv = document.createElement('div');
            couponDiv.classList.add('coupon');
            couponDiv.textContent = '?';
            gridElement.appendChild(couponDiv);
        }
    }
    const gameStatusEl = document.getElementById('game-status');
    if (gameStatusEl) gameStatusEl.textContent = "Click 'Start New Game' to play.";
}

async function startGame() {
    if (!currentUserData) {
        showMessage('User data not available. Cannot start game.', 'error');
        return;
    }
    // Client-side balance check (backend will re-verify)
    if (parseFloat(currentUserData.balance) < CONFIG.costPerGameAttempt) {
        showMessage('Not enough balance to start a new game.', 'error');
        return;
    }

    try {
        const token = getToken();
        const response = await fetch(`${CONFIG.API_BASE_URL}/users/balance`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amountChange: CONFIG.costPerGameAttempt,
                type: 'spend_game'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showMessage(data.message || 'Failed to start game. Please check balance.', 'error');
            return;
        }

        // Update local currentUserData and header
        currentUserData.balance = parseFloat(data.balance);
        currentUserData.moneySpent = parseFloat(data.moneySpent);
        currentUserData.gameAttempts = parseInt(data.gameAttempts);
        storeCurrentUserData(currentUserData); // Update cache in shared.js context
        displayUserInfoInHeader(currentUserData); // Update header display

        // Proceed with client-side game setup
        grid = [];
        winningSequence = [];
        revealedSequence = [];
        gameActive = true;

        for (let r = 0; r < CONFIG.gridSize; r++) {
            grid[r] = [];
            for (let c = 0; c < CONFIG.gridSize; c++) {
                grid[r][c] = {
                    value: Math.floor(Math.random() * (CONFIG.maxCouponValue - CONFIG.minCouponValue + 1)) + CONFIG.minCouponValue,
                    revealed: false,
                    isWinning: false,
                    id: `coupon-${r}-${c}`
                };
            }
        }
        defineWinningSequence(); // Same as before
        winningSequence.forEach(couponPos => {
            grid[couponPos.row][couponPos.col].isWinning = true;
        });
        
        renderGrid();
        document.getElementById('game-status').textContent = `Game started! Find ${couponsToFind} coupons in sequence.`;
        showMessage('New game started!', 'success');
        saveClientSideGameState();

    } catch (error) {
        console.error("Start game API error:", error);
        showMessage('An error occurred while starting the game.', 'error');
    }
}

function defineWinningSequence() { // Remains the same
    winningSequence = [];
    const type = Math.floor(Math.random() * 3);
    let startR, startC, dr, dc;
    if (type === 0) { /* Horizontal */
        startR = Math.floor(Math.random() * CONFIG.gridSize);
        startC = Math.floor(Math.random() * (CONFIG.gridSize - couponsToFind + 1));
        dr = 0; dc = 1;
    } else if (type === 1) { /* Vertical */
        startR = Math.floor(Math.random() * (CONFIG.gridSize - couponsToFind + 1));
        startC = Math.floor(Math.random() * CONFIG.gridSize);
        dr = 1; dc = 0;
    } else { /* Diagonal */
        const diagType = Math.floor(Math.random() * 2);
        if (diagType === 0) {
            startR = Math.floor(Math.random() * (CONFIG.gridSize - couponsToFind + 1));
            startC = Math.floor(Math.random() * (CONFIG.gridSize - couponsToFind + 1));
            dr = 1; dc = 1;
        } else {
            startR = Math.floor(Math.random() * (CONFIG.gridSize - couponsToFind + 1));
            startC = Math.floor(Math.random() * (CONFIG.gridSize - couponsToFind + 1)) + (couponsToFind - 1) ;
            dr = 1; dc = -1;
        }
    }
    for (let i = 0; i < couponsToFind; i++) {
        let r = startR + i * dr;
        let c = startC + i * dc;
        winningSequence.push({ row: r, col: c, value: grid[r][c].value });
    }
}

function renderGrid() { // Remains largely the same
    const gridElement = document.getElementById('lottery-grid');
    gridElement.innerHTML = ''; 
    for (let r = 0; r < CONFIG.gridSize; r++) {
        for (let c = 0; c < CONFIG.gridSize; c++) {
            const couponData = grid[r][c];
            const couponDiv = document.createElement('div');
            couponDiv.classList.add('coupon');
            couponDiv.dataset.row = r;
            couponDiv.dataset.col = c;
            couponDiv.id = couponData.id;
            if (couponData.revealed) {
                couponDiv.classList.add('revealed');
                couponDiv.textContent = `$${couponData.value}`;
                const revealedIndex = revealedSequence.findIndex(s => s.row === r && s.col === c);
                if (revealedIndex !== -1) {
                    couponDiv.classList.add('correct');
                     if (revealedSequence.length === couponsToFind && revealedIndex === couponsToFind - 1) {
                         couponDiv.classList.add('final-win');
                     }
                }
            } else {
                couponDiv.textContent = '?';
                couponDiv.addEventListener('click', handleCouponClick);
            }
            gridElement.appendChild(couponDiv);
        }
    }
}

async function handleCouponClick(event) { // Modified for win condition
    if (!gameActive) {
        showMessage('Please start a new game first.', 'error');
        return;
    }
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);
    const couponData = grid[row][col];

    if (couponData.revealed) return;

    couponData.revealed = true;
    event.target.classList.add('revealed');
    event.target.textContent = `$${couponData.value}`;
    event.target.removeEventListener('click', handleCouponClick);

    const nextExpectedCouponInSequence = winningSequence[revealedSequence.length];

    if (couponData.isWinning && nextExpectedCouponInSequence && nextExpectedCouponInSequence.row === row && nextExpectedCouponInSequence.col === col) {
        revealedSequence.push({ row, col, value: couponData.value });
        event.target.classList.add('correct');
        document.getElementById('game-status').textContent = `Correct! ${couponsToFind - revealedSequence.length} more to go.`;

        if (revealedSequence.length === couponsToFind) {
            let totalWinnings = 0;
            revealedSequence.forEach(c => totalWinnings += c.value);
            
            // --- API CALL FOR WIN ---
            try {
                const token = getToken();
                const response = await fetch(`${CONFIG.API_BASE_URL}/users/balance`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        amountChange: totalWinnings,
                        type: 'win'
                    })
                });
                const data = await response.json();
                if (!response.ok) {
                    showMessage(data.message || 'Error processing win. Contact support.', 'error');
                    // Potentially rollback client-side win indication or mark for admin review
                } else {
                     // Update local currentUserData and header
                    currentUserData.balance = parseFloat(data.balance);
                    currentUserData.moneyWon = parseFloat(data.moneyWon);
                    storeCurrentUserData(currentUserData);
                    displayUserInfoInHeader(currentUserData);
                    
                    document.getElementById('game-status').textContent = `Congratulations! You won $${totalWinnings.toFixed(2)}!`;
                    showMessage(`You found the sequence and won $${totalWinnings.toFixed(2)}!`, 'success');
                    event.target.classList.add('final-win');
                }
            } catch (error) {
                console.error("Win processing API error:", error);
                showMessage('An error occurred processing your win. Contact support.', 'error');
            }
            // --- END API CALL FOR WIN ---
            gameActive = false;
            clearClientSideGameState();
        }
    } else {
        event.target.classList.add('incorrect-in-sequence');
        document.getElementById('game-status').textContent = `Incorrect sequence. Game Over!`;
        showMessage('Oops! That broke the sequence. Game Over.', 'error');
        gameActive = false;
        revealFullWinningSequence();
        clearClientSideGameState();
    }
    saveClientSideGameState();
}

function revealFullWinningSequence() { // Remains the same
    winningSequence.forEach(wp => {
        const couponDiv = document.getElementById(`coupon-${wp.row}-${wp.col}`);
        if (couponDiv && !grid[wp.row][wp.col].revealed) {
            couponDiv.classList.add('revealed', 'correct');
            couponDiv.textContent = `$${grid[wp.row][wp.col].value}`;
        } else if (couponDiv && grid[wp.row][wp.col].revealed && !revealedSequence.find(rs => rs.row === wp.row && rs.col === wp.col)) {
             if (!couponDiv.classList.contains('correct')) couponDiv.classList.add('correct');
        }
    });
}

// --- Client-Side Game State Persistence (for UI, non-critical) ---
function saveClientSideGameState() {
    if (!currentUserData) return;
    const gameState = { grid, winningSequence, revealedSequence, gameActive };
    localStorage.setItem(`gameState_${currentUserData.username}`, JSON.stringify(gameState));
}

function loadClientSideGameState() {
    if (!currentUserData) {
        renderPlaceholderGrid();
        return;
    }
    const savedState = localStorage.getItem(`gameState_${currentUserData.username}`);
    if (savedState) {
        const gameState = JSON.parse(savedState);
        grid = gameState.grid;
        winningSequence = gameState.winningSequence;
        revealedSequence = gameState.revealedSequence;
        gameActive = gameState.gameActive;

        if (gameActive) {
            renderGrid();
            let remainingToFind = couponsToFind - revealedSequence.length;
            if (remainingToFind > 0) {
                document.getElementById('game-status').textContent = `Game in progress. ${remainingToFind} more to go.`;
            } else if (remainingToFind === 0 && revealedSequence.length === couponsToFind) {
                let totalWinnings = 0;
                revealedSequence.forEach(c => totalWinnings += c.value);
                document.getElementById('game-status').textContent = `You previously won $${totalWinnings.toFixed(2)}! Start a new game.`;
                gameActive = false; 
                clearClientSideGameState(); 
            }
        } else {
            renderPlaceholderGrid();
        }
    } else {
        renderPlaceholderGrid();
    }
}

function clearClientSideGameState() {
    if (!currentUserData) return;
    localStorage.removeItem(`gameState_${currentUserData.username}`);
    grid = []; winningSequence = []; revealedSequence = [];
}