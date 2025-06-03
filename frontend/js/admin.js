// frontend/js/admin.js
// Ensure CONFIG, showMessage, getToken, getCurrentUserData, displayUserInfoInHeader are available
// Socket.IO instance might be shared or re-initialized if admin uses same chat UI
let socket; // Potentially shared with chat.js if on same page, or re-init
let currentUserData = null;

async function initializePage(userData) {
    currentUserData = userData;
    if (!currentUserData || currentUserData.role !== 'admin') {
        showMessage("Access Denied or user data not loaded.", "error");
        // Redirect handled by shared.js, but good to be defensive
        document.querySelector('.container').innerHTML = '<h1>Access Denied</h1>';
        return;
    }

    const token = getToken(); // From shared.js
    if (!token) {
        showMessage("Admin not authenticated.", "error");
        return;
    }

    // Initialize Socket.IO for admin chat functionalities
    socket = io(CONFIG.SOCKET_URL, {
        auth: { token }
    });
    setupAdminSocketListeners(); // Separate listeners if admin has different needs

    loadAdminUserMessages(); // Loads messages into the admin view
    loadAllUsersForAdminTable();
}

function setupAdminSocketListeners() {
    socket.on('connect', () => console.log('Admin connected to chat server:', socket.id));
    socket.on('disconnect', () => console.log('Admin disconnected from chat server.'));
    socket.on('connect_error', (err) => showMessage(`Admin chat connection error: ${err.message}`, 'error'));

    socket.on('newMessage', (message) => {
        // Admin sees all messages, or messages directed to specific users if they sent them.
        // The display logic in loadAdminUserMessages/displayAdminMessage will handle grouping.
        // For real-time updates, might need to intelligently add to existing user blocks.
        // A simple approach: re-fetch and re-render the specific user's block or the whole list.
        // For now, let's assume admin might need to refresh to see new messages, or we implement smarter updates.
        console.log("Admin received new message:", message);
        // Potentially call a function to add this message to the correct user's thread dynamically
        addRealtimeMessageToAdminView(message);
    });
     socket.on('chatError', (error) => showMessage(error.message || 'Admin chat error.', 'error'));
}

async function loadAdminUserMessages() {
    const messageListDiv = document.getElementById('admin-message-list');
    if (!messageListDiv) return;
    messageListDiv.innerHTML = 'Loading messages...';

    const token = getToken();
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/chat/messages`, { // Admin gets all via this route
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allMessages = await response.json();

        if (!response.ok) {
            showMessage(allMessages.message || 'Failed to load user messages.', 'error');
            messageListDiv.innerHTML = '<p>Error loading messages.</p>';
            return;
        }

        messageListDiv.innerHTML = ''; // Clear loading
        if (allMessages.length === 0) {
            messageListDiv.innerHTML = '<p>No support messages from users yet.</p>';
            return;
        }
    
        // Group messages by user for display (user-originated messages)
        // Or, if admin sent a message to a user, that thread also needs to appear.
        const messagesByConversation = {}; // Key: other_user_username

        allMessages.forEach(msg => {
            let conversationKey;
            if (msg.is_admin_message) { // Admin sent this
                if (msg.recipient_username) { // To a specific user
                    conversationKey = msg.recipient_username;
                } else {
                    return; // Admin message not to a specific user, skip for this threaded view
                }
            } else { // User sent this (to admin pool)
                conversationKey = msg.sender_username;
            }

            if (!messagesByConversation[conversationKey]) {
                messagesByConversation[conversationKey] = [];
            }
            messagesByConversation[conversationKey].push(msg);
        });


        for (const usernameInvolved in messagesByConversation) {
            const userMessageBlock = document.createElement('div');
            userMessageBlock.classList.add('admin-message-block');
            userMessageBlock.dataset.username = usernameInvolved; // For targeting updates
            
            const userHeader = document.createElement('h3');
            userHeader.textContent = `Conversation with: ${usernameInvolved}`;
            userMessageBlock.appendChild(userHeader);

            const conversationThreadDiv = document.createElement('div');
            conversationThreadDiv.classList.add('conversation-thread'); // For scrolling/styling
            conversationThreadDiv.style.maxHeight = '300px';
            conversationThreadDiv.style.overflowY = 'auto';
            conversationThreadDiv.style.border = '1px solid #eee';
            conversationThreadDiv.style.padding = '5px';


            messagesByConversation[usernameInvolved]
                .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) // Sort messages
                .forEach(msg => {
                    displayAdminMessageInThread(msg, conversationThreadDiv, usernameInvolved);
                });
            userMessageBlock.appendChild(conversationThreadDiv);

            const replyTextarea = document.createElement('textarea');
            replyTextarea.placeholder = `Reply to ${usernameInvolved}...`;
            replyTextarea.style.width = 'calc(100% - 22px)';
            replyTextarea.style.minHeight = '50px';
            replyTextarea.style.marginTop = '10px';
            userMessageBlock.appendChild(replyTextarea);

            const replyButton = document.createElement('button');
            replyButton.textContent = 'Send Reply';
            replyButton.style.marginTop = '5px';
            replyButton.onclick = () => sendAdminReply(usernameInvolved, replyTextarea.value, replyTextarea);
            userMessageBlock.appendChild(replyButton);
            
            messageListDiv.appendChild(userMessageBlock);
        }

    } catch (error) {
        console.error("Admin load messages error:", error);
        showMessage('Error loading user messages.', 'error');
        messageListDiv.innerHTML = '<p>Error loading messages.</p>';
    }
}

function displayAdminMessageInThread(msg, threadContainer, conversationPartnerUsername) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    let senderDisplayName;
    if (msg.is_admin_message) { // Admin sent this
        messageDiv.classList.add('admin'); // Style as admin message
        senderDisplayName = 'You (Admin)';
    } else { // User sent this
        messageDiv.classList.add('user'); // Style as user message
        senderDisplayName = msg.sender_username;
    }

    messageDiv.innerHTML = `
        <span class="sender">${senderDisplayName} (${new Date(msg.timestamp).toLocaleString()})</span>
        <p class="text">${msg.message_text}</p>
    `;
    threadContainer.appendChild(messageDiv);
    threadContainer.scrollTop = threadContainer.scrollHeight; // Scroll to bottom
}

function addRealtimeMessageToAdminView(msg) {
    let conversationKey;
    if (msg.is_admin_message) {
        if (!msg.recipient_username) return; // Not for a specific user thread
        conversationKey = msg.recipient_username;
    } else {
        conversationKey = msg.sender_username;
    }

    const userBlock = document.querySelector(`.admin-message-block[data-username="${conversationKey}"]`);
    if (userBlock) {
        const threadContainer = userBlock.querySelector('.conversation-thread');
        if (threadContainer) {
            displayAdminMessageInThread(msg, threadContainer, conversationKey);
        }
    } else {
        // New conversation, might need to dynamically create the whole block
        // For simplicity, admin might need to refresh to see entirely new user threads
        // Or, call loadAdminUserMessages() again, but that's inefficient.
        console.log("New conversation started by", conversationKey, "- consider dynamic block creation or refresh.");
        // Quick and dirty refresh for now:
        // loadAdminUserMessages();
    }
}


function sendAdminReply(recipientUsername, text, textareaElement) {
    if (!text.trim()) {
        showMessage('Reply cannot be empty.', 'error', 'message-area');
        return;
    }
    if (!socket || !socket.connected) {
        showMessage('Not connected to chat server. Cannot send reply.', 'error');
        return;
    }

    const messageData = {
        text: text,
        recipientUsername: recipientUsername // Backend uses this to target
    };
    socket.emit('sendMessage', messageData); // Server handles isAdminMessage flag based on socket.user.role

    if (textareaElement) textareaElement.value = '';
    // The 'newMessage' event from server should update the admin's view.
    showMessage(`Reply attempt sent to ${recipientUsername}.`, 'success', 'message-area');
}


async function loadAllUsersForAdminTable() {
    const userTableBody = document.querySelector('#user-table tbody');
    if (!userTableBody) return;
    userTableBody.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>';

    const token = getToken();
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();

        if (!response.ok) {
            userTableBody.innerHTML = `<tr><td colspan="5">${users.message || 'Failed to load users.'}</td></tr>`;
            return;
        }
        userTableBody.innerHTML = ''; // Clear loading
        if (users.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
            return;
        }
        users.forEach(user => {
            const row = userTableBody.insertRow();
            row.insertCell().textContent = user.username;
            row.insertCell().textContent = `$${parseFloat(user.balance || 0).toFixed(2)}`;
            row.insertCell().textContent = `$${parseFloat(user.money_spent || 0).toFixed(2)}`;
            row.insertCell().textContent = `$${parseFloat(user.money_won || 0).toFixed(2)}`;
            
            const actionsCell = row.insertCell();
            const adjustBalanceButton = document.createElement('button');
            adjustBalanceButton.textContent = 'Set Balance';
            adjustBalanceButton.onclick = () => promptSetBalance(user.id, user.username, user.balance);
            actionsCell.appendChild(adjustBalanceButton);
        });
    } catch (error) {
        console.error("Admin load users API error:", error);
        userTableBody.innerHTML = '<tr><td colspan="5">Error loading users.</td></tr>';
    }
}

async function promptSetBalance(userId, username, currentBalance) {
    const newBalanceStr = prompt(`Enter new balance for ${username} (current: $${parseFloat(currentBalance).toFixed(2)}):`);
    if (newBalanceStr === null) return;

    const newBalance = parseFloat(newBalanceStr);
    if (isNaN(newBalance) || newBalance < 0) {
        alert('Invalid amount. Must be a non-negative number.');
        return;
    }

    const token = getToken();
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/admin/users/${userId}/balance`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount: newBalance }) // 'amount' is the new balance to set
        });
        const data = await response.json();
        if (!response.ok) {
            showMessage(data.message || 'Failed to update balance.', 'error');
        } else {
            showMessage(data.message, 'success');
            loadAllUsersForAdminTable(); // Refresh table
        }
    } catch (error) {
        console.error("Admin set balance API error:", error);
        showMessage('Error updating balance.', 'error');
    }
}