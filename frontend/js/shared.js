// frontend/js/shared.js

// --- Authentication & Token Management ---
function getToken() {
    return localStorage.getItem('lotteryToken');
}

function setToken(token) {
    localStorage.setItem('lotteryToken', token);
}

function removeToken() {
    localStorage.removeItem('lotteryToken');
    localStorage.removeItem('currentUserData'); // Clear cached user data
}

function storeCurrentUserData(userData) {
    localStorage.setItem('currentUserData', JSON.stringify(userData));
}

function getCurrentUserData() {
    const data = localStorage.getItem('currentUserData');
    return data ? JSON.parse(data) : null;
}

async function fetchCurrentUserData() {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) removeToken(); // Token invalid
            throw new Error('Failed to fetch user data');
        }
        const userData = await response.json();
        storeCurrentUserData(userData); // Cache it
        return userData;
    } catch (error) {
        console.error("Error fetching current user:", error);
        removeToken(); // Clear token on error
        return null;
    }
}


// --- Page Protection & Initialization ---
async function initializeApplication() {
    const currentPage = window.location.pathname.split("/").pop();
    const userData = await fetchCurrentUserData(); // This also updates cached data

    if (!userData) { // No valid token or user data
        if (currentPage !== 'index.html' && currentPage !== '') {
            window.location.href = 'index.html';
            return false;
        }
    } else { // User is logged in
        if (currentPage === 'index.html' || currentPage === '') {
            if (userData.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'game.html';
            }
            return false; // Redirected
        }
        // If on admin page but not admin role
        if (currentPage === 'admin.html' && userData.role !== 'admin') {
            alert('Access Denied: Admins only.');
            window.location.href = 'game.html';
            return false;
        }
    }
    
    displayUserInfoInHeader(userData); // Display info if user data available

    // Call page-specific initializer if it exists
    if (typeof initializePage === 'function') {
        initializePage(userData); // Pass userData to page-specific init
    }
    return true;
}


// --- Header Display ---
function displayUserInfoInHeader(currentUser) { // Now takes currentUser as argument
    const userInfoDiv = document.getElementById('user-info');
    if (userInfoDiv && currentUser) {
        userInfoDiv.innerHTML = `
            <span>Logged in as: ${currentUser.username} (${currentUser.role})</span>
            <span>Balance: $${parseFloat(currentUser.balance).toFixed(2)}</span>
            <button class_name="logout-button" onclick="logout()">Logout</button>
        `;
        const nav = document.querySelector('header nav');
        if (nav) {
            nav.innerHTML = '';
            if (currentUser.role === 'admin') {
                nav.innerHTML += `<a href="admin.html">Admin Panel</a>`;
                 // Admin might also want to see game/stats for testing
                nav.innerHTML += `<a href="game.html">Game View</a>`;
                nav.innerHTML += `<a href="help.html">Help Center (View)</a>`;
            } else {
                nav.innerHTML += `<a href="game.html">Game</a>`;
                nav.innerHTML += `<a href="stats.html">My Stats</a>`;
                nav.innerHTML += `<a href="help.html">Help Center</a>`;
            }
        }
    } else if (userInfoDiv) {
        userInfoDiv.innerHTML = '';
    }
}

async function logout() {
    removeToken();
    // Optionally: call a /api/auth/logout endpoint if your backend implements token invalidation
    window.location.href = 'index.html';
}

// --- Message Display Utility ---
function showMessage(text, type = 'info', elementId = 'message-area') {
    const messageArea = document.getElementById(elementId);
    if (messageArea) {
        messageArea.textContent = text;
        messageArea.className = type;
        messageArea.style.display = 'block';
        setTimeout(() => {
            messageArea.style.display = 'none';
            messageArea.textContent = '';
            messageArea.className = '';
        }, 5000);
    } else {
        alert(text);
    }
}

// --- Global event listener for DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApplication(); // Centralized initialization
});