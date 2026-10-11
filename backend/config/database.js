const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool(config.db);

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection,
  query: (sql, params) => pool.execute(sql, params)
};