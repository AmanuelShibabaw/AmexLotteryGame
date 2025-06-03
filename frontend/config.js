// frontend/config.js
const FRONTEND_CONFIG = {
    API_BASE_URL: 'http://localhost:3001/api', // Your backend API URL
    SOCKET_URL: 'http://localhost:3001',     // Your backend Socket.IO URL
    // Keep client-side game config if not moving it to backend
    gridSize: 5,
    couponsInWinningSequence: 3,
    minCouponValue: 10,
    maxCouponValue: 100,
    costPerGameAttempt: 5,
};
// Replace original CONFIG object if you had one
const CONFIG = FRONTEND_CONFIG;