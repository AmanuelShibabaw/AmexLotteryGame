// backend/scripts/hashAdminPassword.js
const bcrypt = require('bcryptjs');

const passwordToHash = 'adminpassword'; // This will be the admin's login password

bcrypt.hash(passwordToHash, 10, (err, hash) => { // 10 is the saltRounds
    if (err) {
        console.error("Error hashing password:", err);
        return;
    }
    console.log(`Password to hash: ${passwordToHash}`);
    console.log("Generated bcrypt hash:", hash);
    console.log("\nUse the 'Generated bcrypt hash' value in your SQL INSERT statement.");
});