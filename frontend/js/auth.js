// frontend/js/auth.js
// Ensure CONFIG is available from frontend/config.js
// Ensure showMessage, setToken, storeCurrentUserData are available from shared.js

document.addEventListener('DOMContentLoaded', () => {
    // initializeApplication in shared.js handles initial redirect if logged in.
    // So, if we are here on index.html, user is not logged in or auth check is pending.

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
});

function toggleForms() {
    const loginContainer = document.getElementById('login-form-container');
    const signupContainer = document.getElementById('signup-form-container');
    const messageArea = document.getElementById('message-area');
    if (messageArea) messageArea.style.display = 'none';

    if (loginContainer.style.display === 'none') {
        loginContainer.style.display = 'block';
        signupContainer.style.display = 'none';
    } else {
        loginContainer.style.display = 'none';
        signupContainer.style.display = 'block';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showMessage('Please enter both username and password.', 'error');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();

        if (!response.ok) {
            showMessage(data.message || 'Login failed.', 'error');
            return;
        }

        setToken(data.token);
        storeCurrentUserData({ // Store basic info needed for immediate redirect and header
            id: data.id,
            username: data.username,
            role: data.role,
            balance: data.balance
        });

        if (data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'game.html';
        }

    } catch (error) {
        console.error('Login API error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!username || !password) {
        showMessage('Please fill in all fields.', 'error');
        return;
    }
     if (username.toLowerCase() === 'admin') {
        showMessage('Registration with username "admin" is not allowed through this form.', 'error');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();

        if (!response.ok) {
            showMessage(data.message || 'Signup failed.', 'error');
            return;
        }
        
        // Don't auto-login on signup in this flow, prompt to login
        showMessage('Signup successful! Please login.', 'success');
        toggleForms(); // Switch to login form
        document.getElementById('signup-form').reset();

    } catch (error) {
        console.error('Signup API error:', error);
        showMessage('An error occurred during signup. Please try again.', 'error');
    }
}