// backend/routes/userRoutes.js
const express = require('express');
const pool = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT balance, money_spent, money_won, game_attempts FROM users WHERE id = ?',
            [req.user.id]
        );
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Update user balance (e.g., after game events)
// @route   PUT /api/users/balance
// @access  Private (Server should validate these updates carefully)
router.put('/balance', protect, async (req, res) => {
    const { amountChange, type } = req.body; // type can be 'win', 'spend_game'
    const userId = req.user.id;

    if (typeof amountChange !== 'number') {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [currentUserArr] = await connection.query('SELECT balance, money_spent, money_won, game_attempts FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (currentUserArr.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }
        let currentUser = currentUserArr[0];
        let newBalance = parseFloat(currentUser.balance);
        let newMoneySpent = parseFloat(currentUser.money_spent);
        let newMoneyWon = parseFloat(currentUser.money_won);
        let newGameAttempts = parseInt(currentUser.game_attempts);

        if (type === 'spend_game') {
            if (newBalance < amountChange) { // amountChange should be positive cost
                await connection.rollback();
                return res.status(400).json({ message: 'Insufficient balance' });
            }
            newBalance -= amountChange;
            newMoneySpent += amountChange;
            newGameAttempts += 1;
        } else if (type === 'win') { // amountChange should be positive winnings
            newBalance += amountChange;
            newMoneyWon += amountChange;
        } else {
            await connection.rollback();
            return res.status(400).json({ message: 'Invalid transaction type' });
        }
        
        await connection.query(
            'UPDATE users SET balance = ?, money_spent = ?, money_won = ?, game_attempts = ? WHERE id = ?',
            [newBalance.toFixed(2), newMoneySpent.toFixed(2), newMoneyWon.toFixed(2), newGameAttempts, userId]
        );

        await connection.commit();
        res.json({
            message: 'Balance updated successfully',
            balance: newBalance.toFixed(2),
            moneySpent: newMoneySpent.toFixed(2),
            moneyWon: newMoneyWon.toFixed(2),
            gameAttempts: newGameAttempts
        });

    } catch (error) {
        await connection.rollback();
        console.error('Update balance error:', error);
        res.status(500).json({ message: 'Server error while updating balance' });
    } finally {
        if (connection) connection.release();
    }
});


module.exports = router;