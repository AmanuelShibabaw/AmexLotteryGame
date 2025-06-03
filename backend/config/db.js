// backend/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config(); // To load .env variables

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);

console.log('DB_NAME:', process.env.DB_NAME);

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('MySQL Connected successfully!');
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to MySQL:', err.stack);
        process.exit(1); // Exit if DB connection fails
    });

module.exports = pool;