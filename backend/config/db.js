const mysql = require('mysql2');

// Create a connection pool to handle multiple simultaneous dashboard requests
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Godscrown1#', // <-- Replace with your actual MySQL Workbench password!
    database: 'ledgerflowdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export the promise-based wrapper so we can use clean async/await syntax later
const db = pool.promise();

module.exports = db;