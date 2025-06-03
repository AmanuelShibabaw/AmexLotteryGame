// backend/routes/chatRoutes.js
const express = require('express');
const pool = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// @desc    Get chat messages for a user (or all for admin)
// @route   GET /api/chat/messages
// @access  Private
router.get('/messages', protect, async (req, res) => {
    try {
        let query;
        let queryParams = [];

        if (req.user.role === 'admin') {
            // Admin gets all messages, or can filter by user if a userId is provided in query
            // For simplicity, admin gets all non-admin messages initially, or messages they sent
            query = `
                SELECT cm.id, cm.message_text, cm.timestamp, cm.is_admin_message, cm.read_by_admin,
                       u_sender.username as sender_username, u_sender.id as sender_id,
                       cm.recipient_username
                FROM chat_messages cm
                JOIN users u_sender ON cm.sender_id = u_sender.id
                ORDER BY cm.timestamp ASC
            `;
        } else {
            // Regular user gets messages they sent or messages from admin directed to them
            query = `
                SELECT cm.id, cm.message_text, cm.timestamp, cm.is_admin_message,
                       u_sender.username as sender_username, u_sender.id as sender_id,
                       cm.recipient_username
                FROM chat_messages cm
                JOIN users u_sender ON cm.sender_id = u_sender.id
                WHERE cm.sender_id = ? OR (cm.is_admin_message = TRUE AND cm.recipient_username = ?)
                ORDER BY cm.timestamp ASC
            `;
            queryParams = [req.user.id, req.user.username];
        }
        
        const [messages] = await pool.query(query, queryParams);
        res.json(messages);

    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;