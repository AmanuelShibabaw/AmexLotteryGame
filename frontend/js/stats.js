// frontend/js/stats.js
// Ensure CONFIG, showMessage, getToken, displayUserInfoInHeader, getCurrentUserData are available

let currentUserData = null;

async function initializePage(userData) {
    currentUserData = userData;
    if (!currentUserData) {
         document.querySelector('.container').innerHTML = "<p>Please login to see your stats.</p>";
        return;
    }
    loadUserStats();
}

async function loadUserStats() {
    if (!currentUserData) return; // Should be handled by initializePage
    const token = getToken();
    if (!token) {
        showMessage("Not logged in.", "error");
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/users/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await response.json();

        if (!response.ok) {
            showMessage(stats.message || 'Failed to load stats.', 'error');
            return;
        }
        
        // Update current user data cache as well, as stats might be more up-to-date
        currentUserData.balance = parseFloat(stats.balance);
        currentUserData.moneySpent = parseFloat(stats.money_spent);
        currentUserData.moneyWon = parseFloat(stats.money_won);
        currentUserData.gameAttempts = parseInt(stats.game_attempts);
        storeCurrentUserData(currentUserData); // from shared.js
        displayUserInfoInHeader(currentUserData); // Refresh header, esp. balance

        const moneySpent = parseFloat(stats.money_spent) || 0;
        const moneyWon = parseFloat(stats.money_won) || 0;
        const gameAttempts = parseInt(stats.game_attempts) || 0;
        const netProfit = moneyWon - moneySpent;

        document.getElementById('money-spent').textContent = `$${moneySpent.toFixed(2)}`;
        document.getElementById('money-won').textContent = `$${moneyWon.toFixed(2)}`;
        document.getElementById('net-profit').textContent = `$${netProfit.toFixed(2)}`;
        document.getElementById('game-attempts').textContent = gameAttempts;

        const netProfitEl = document.getElementById('net-profit');
        if (netProfit < 0) netProfitEl.style.color = 'red';
        else if (netProfit > 0) netProfitEl.style.color = 'green';
        else netProfitEl.style.color = 'inherit';

    } catch (error) {
        console.error("Load stats API error:", error);
        showMessage('Error loading statistics.', 'error');
    }
}