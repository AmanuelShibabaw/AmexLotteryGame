// backend/routes/adminRoutes.js
const express = require('express');
const pool = require('../config/db');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

// @desc    Get all users (for admin)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, role, balance, money_spent, money_won, game_attempts, created_at FROM users WHERE role != "admin"');
        res.json(users);
    } catch (error) {
        console.error('Admin get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Admin adjust user balance
// @route   PUT /api/admin/users/:userId/balance
// @access  Private/Admin
router.put('/users/:userId/balance', protect, admin, async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body; // amount to set the balance to, or change by

    if (typeof amount !== 'number') {
        return res.status(400).json({ message: 'Invalid amount specified' });
    }

    try {
        // For simplicity, setting absolute balance. Can be changed to adjust.
        const [result] = await pool.query('UPDATE users SET balance = ? WHERE id = ? AND role != "admin"', [amount.toFixed(2), userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or cannot modify admin balance' });
        }
        res.json({ message: `Balance for user ID ${userId} updated to ${amount.toFixed(2)}` });
    } catch (error) {
        console.error('Admin update balance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// (Admin can view messages via GET /api/chat/messages with their admin role)

module.exports = router;