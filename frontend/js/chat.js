// <!-- Add to help.html and admin.html <head> or before your chat.js script -->
// <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
// <!-- Or if serving from backend: <script src="/socket.io/socket.io.js"></script> -->


// // Include Socket.IO client library in help.html (and admin.html if admin uses the same chat UI).
// // help.html: <script src="/socket.io/socket.io.js"></script> (if backend serves it) OR <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>

// frontend/js/chat.js
// Ensure CONFIG, showMessage, getToken, getCurrentUserData are available
let socket;
let currentUserData = null; // Will be populated by initializePage

async function initializePage(userData) {
    currentUserData = userData;
    if (!currentUserData) {
        showMessage("User data not loaded. Chat unavailable.", "error");
        return;
    }

    const token = getToken();
    if (!token) {
        showMessage("Not authenticated. Chat unavailable.", "error");
        return;
    }
    
    // Connect to Socket.IO server, passing token for authentication
    socket = io(CONFIG.SOCKET_URL, {
        auth: { token }
    });

    setupSocketListeners();
    fetchInitialMessages();

    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleSendMessage);
    }
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to chat server with ID:', socket.id);
        showMessage('Connected to help chat.', 'success');
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from chat server:', reason);
        showMessage('Disconnected from help chat. Attempting to reconnect...', 'error');
    });

    socket.on('connect_error', (err) => {
        console.error('Chat connection error:', err.message);
        showMessage(`Chat connection failed: ${err.message}. Ensure backend is running.`, 'error');
        // Potentially disable chat input here
    });

    socket.on('newMessage', (message) => {
        // Only display if relevant to current user or if current user is admin
        if (currentUserData.role === 'admin' || 
            message.sender_id === currentUserData.id || // Sent by me
            (message.is_admin_message && message.recipient_username === currentUserData.username) || // Admin sent to me
            (!message.is_admin_message && currentUserData.role === 'admin') // User sent to admin pool
           ) {
            displayMessage(message);
        }
    });

    socket.on('chatError', (error) => {
        showMessage(error.message || 'A chat error occurred.', 'error');
    });
}

async function fetchInitialMessages() {
    const token = getToken();
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/chat/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();
        if (!response.ok) {
            showMessage(messages.message || 'Failed to load chat history.', 'error');
            return;
        }
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = ''; // Clear
        if (messages.length === 0) {
             messagesContainer.innerHTML = '<p>No messages yet. Type a message to start.</p>';
        } else {
            messages.forEach(displayMessage);
        }
    } catch (error) {
        console.error("Fetch chat history error:", error);
        showMessage('Error loading chat history.', 'error');
    }
}

function displayMessage(msg) { // msg is { id, sender_username, sender_id, message_text, timestamp, is_admin_message, recipient_username }
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    let senderDisplayName;
    // Determine if the message is from the current user or another party
    if (msg.sender_id === currentUserData.id) {
        messageDiv.classList.add('user'); // Message sent by current user
        senderDisplayName = 'You';
    } else if (msg.is_admin_message) {
        messageDiv.classList.add('admin'); // Message sent by an admin
        senderDisplayName = 'Admin';
    } else {
        // Message from another user (primarily for admin view)
        messageDiv.classList.add('other-user'); // Or just 'user' if admin sees other users' messages as 'user'
        senderDisplayName = msg.sender_username;
    }

    // Admin replying to specific user.
    let recipientInfo = '';
    if (currentUserData.role === 'admin' && msg.is_admin_message && msg.recipient_username) {
        recipientInfo = ` (to ${msg.recipient_username})`;
    }
    // User message seen by Admin.
    else if (currentUserData.role === 'admin' && !msg.is_admin_message) {
        // No special recipient info needed here, admin is the recipient by default for user messages
    }


    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = `${senderDisplayName}${recipientInfo}`;

    const textP = document.createElement('p');
    textP.classList.add('text');
    textP.textContent = msg.message_text;
    
    const timeStampSpan = document.createElement('span');
    timeStampSpan.style.fontSize = '0.7em';
    timeStampSpan.style.color = '#888';
    timeStampSpan.style.display = 'block';
    timeStampSpan.textContent = new Date(msg.timestamp).toLocaleString();

    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(textP);
    messageDiv.appendChild(timeStampSpan);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleSendMessage(event) {
    event.preventDefault();
    const messageInput = document.getElementById('chat-message-input');
    const text = messageInput.value.trim();

    if (!text || !socket || !socket.connected) {
        showMessage('Cannot send message. Not connected or message empty.', 'error');
        return;
    }
    
    const messageData = { text };
    // For Admin replies, the `admin.js` will handle setting recipientUsername
    // For user, it's always to admin pool.

    socket.emit('sendMessage', messageData);
    messageInput.value = '';
}