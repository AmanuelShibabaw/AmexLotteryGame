// backend/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
require('dotenv').config();

const router = express.Router();

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password' });
    }

    try {
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Special handling for 'admin' username during registration attempt
        let role = 'user';
        if (username.toLowerCase() === 'admin') {
            // This is a simple check. Real admin creation should be more secure/manual.
            // Or, you might disallow 'admin' registration here and handle admin creation separately.
            // For this example, if someone tries to register as 'admin', we check if an admin already exists.
            // If not, and the password matches a pre-defined one (less secure), or just make them admin.
            // Better: block 'admin' registration via this public route.
            // For now, we'll stick to the DB pre-population for admin or a secure setup.
            // Let's assume admin is pre-created. We prevent 'admin' registration by normal users.
            const [adminConfigUser] = await pool.query('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin']);
            if (adminConfigUser.length > 0) {
                 return res.status(400).json({ message: 'Admin username is reserved or already configured.' });
            }
            // If you want to allow creating the *first* admin this way, add specific logic
            // For now, 'admin' username will be treated as a normal user if no admin with that name exists.
            // OR, more simply, if trying to register 'admin', force 'user' role.
            // if (username.toLowerCase() === 'admin') role = 'user'; // Or block it
        }


        const [result] = await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, password_hash, role]
        );
        const userId = result.insertId;

        res.status(201).json({
            id: userId,
            username: username,
            role: role,
            token: generateToken(userId, role), // Send token upon registration
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            balance: user.balance,
            token: generateToken(user.id, user.role),
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
    // req.user is attached by the 'protect' middleware
    res.json({
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        balance: req.user.balance,
        moneySpent: req.user.money_spent, // Fetch these from DB if not in protect
        moneyWon: req.user.money_won,
        gameAttempts: req.user.game_attempts
    });
});


const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d', // Token expiration
    });
};

module.exports = router;