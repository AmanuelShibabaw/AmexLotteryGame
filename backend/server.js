// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/db'); // Ensures DB connection is attempted at start

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes'); // For fetching history
const adminRoutes = require('./routes/adminRoutes');
const { protect } = require('./middleware/authMiddleware'); // For socket auth (simplified)

const app = express();
const server = http.createServer(app);

// CORS setup - adjust origin for your frontend URL in production
const io = new Server(server, {
    cors: {
        origin: "http://127.0.0.1:5500", // Or your frontend dev server URL. For production, set this properly.
        methods: ["GET", "POST"]
    }
});

app.use(cors({ origin: "http://127.0.0.1:5500" })); // For Express routes
app.use(express.json()); // Middleware to parse JSON bodies

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);


// Socket.IO Authentication (simplified for this example)
// A more robust solution would involve passing JWT with socket connection
// and verifying it.
io.use(async (socket, next) => {
    // This is a very basic auth. In real app, you'd verify a token.
    // For now, we'll assume client sends userId upon connection or with messages.
    // Or, for a better approach, client sends token in auth handshake.
    const token = socket.handshake.auth.token;
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [rows] = await pool.query('SELECT id, username, role FROM users WHERE id = ?', [decoded.id]);
            if (rows.length > 0) {
                socket.user = rows[0]; // Attach user to socket object
                return next();
            }
            return next(new Error('Authentication error: User not found'));
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    } else {
        return next(new Error('Authentication error: No token provided'));
        // Or allow anonymous connection if parts of chat are public
    }
});


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}, Username: ${socket.user ? socket.user.username : 'Unknown'}`);

    // Join a room based on user ID for direct messages or notifications
    if (socket.user) {
        socket.join(socket.user.id.toString()); // User-specific room
        if (socket.user.role === 'admin') {
            socket.join('admin_room'); // Admins join a common admin room
        }
    }

    socket.on('sendMessage', async (data) => {
        // data = { text: "message content", recipientUsername: "optional_for_admin_reply" }
        if (!socket.user || !data.text) {
            socket.emit('chatError', { message: 'Cannot send empty message or not authenticated.' });
            return;
        }

        const senderId = socket.user.id;
        const senderUsername = socket.user.username;
        const isAdminMessage = socket.user.role === 'admin';
        const messageText = data.text;
        const recipientUsername = data.recipientUsername || null; // For admin replies

        try {
            const [result] = await pool.query(
                'INSERT INTO chat_messages (sender_id, message_text, is_admin_message, recipient_username) VALUES (?, ?, ?, ?)',
                [senderId, messageText, isAdminMessage, recipientUsername]
            );
            const newMessageId = result.insertId;

            const [rows] = await pool.query('SELECT timestamp FROM chat_messages WHERE id = ?', [newMessageId]);
            const timestamp = rows[0].timestamp;

            const messagePayload = {
                id: newMessageId,
                sender_id: senderId,
                sender_username: senderUsername,
                message_text: messageText,
                timestamp: timestamp,
                is_admin_message: isAdminMessage,
                recipient_username: recipientUsername
            };

            if (isAdminMessage && recipientUsername) {
                // Admin sending to a specific user
                // Find recipient's socket if online, or just store
                const [recipientUserArr] = await pool.query('SELECT id FROM users WHERE username = ?', [recipientUsername]);
                if (recipientUserArr.length > 0) {
                    const recipientId = recipientUserArr[0].id;
                    io.to(recipientId.toString()).emit('newMessage', messagePayload); // Send to specific user's room
                }
                io.to('admin_room').emit('newMessage', messagePayload); // Also show in admin's own chat
            } else if (!isAdminMessage) {
                // User sending to admin
                io.to('admin_room').emit('newMessage', messagePayload); // Send to all admins
                socket.emit('newMessage', messagePayload); // Echo to sender
            } else {
                // Admin sending a general message (not currently a feature, but could be broadcast)
                io.emit('newMessage', messagePayload); // Broadcast to all if needed, or just admins
            }

        } catch (error) {
            console.error('Error saving/sending message:', error);
            socket.emit('chatError', { message: 'Failed to send message.' });
        }
    });

    socket.on('markAsRead', async (messageId) => { // For admin to mark messages
        if (socket.user && socket.user.role === 'admin') {
            try {
                await pool.query('UPDATE chat_messages SET read_by_admin = TRUE WHERE id = ?', [messageId]);
                // Optionally, notify relevant parties or update UI
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        }
    });


    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));