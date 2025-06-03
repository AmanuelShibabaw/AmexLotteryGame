-- database_schema.sql (for reference)
CREATE DATABASE IF NOT EXISTS lottery_db;
USE lottery_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    balance DECIMAL(10, 2) DEFAULT 100.00,
    money_spent DECIMAL(10, 2) DEFAULT 0.00,
    money_won DECIMAL(10, 2) DEFAULT 0.00,
    game_attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_username VARCHAR(50) NULL, -- For direct admin replies to a user
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_admin_message BOOLEAN DEFAULT FALSE, -- True if message is from admin
    read_by_admin BOOLEAN DEFAULT FALSE,   -- For user messages to admin
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optional: Insert a default admin user (hash the password appropriately)
-- For "adminpassword", the bcrypt hash might look something like:
-- '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
-- You'll need to generate this hash using bcrypt in a script or when the app first runs.
-- INSERT INTO users (username, password_hash, role, balance) VALUES ('admin', 'YOUR_BCRYPT_HASH_FOR_ADMINPASSWORD', 'admin', 0);