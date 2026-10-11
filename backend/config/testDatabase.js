const { pool, testConnection } = require('./database');

async function runTest() {
  console.log('Testing database connection...');
  console.log('Host:', process.env.DB_HOST || 'localhost');
  console.log('Port:', process.env.DB_PORT || 3306);
  console.log('Database:', process.env.DB_NAME || 'travelmind_ai');
  console.log('User:', process.env.DB_USER || 'root');
  console.log('');

  try {
    const connected = await testConnection();
    
    if (connected) {
      console.log('✓ Database connection test PASSED');
      console.log('');
      
      const [rows] = await pool.execute('SELECT 1 as test');
      console.log('Query result:', rows);
      
      await pool.end();
      console.log('');
      console.log('Connection pool closed.');
      process.exit(0);
    } else {
      console.log('✗ Database connection test FAILED');
      await pool.end();
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Database connection test FAILED with error:');
    console.error(error.message);
    process.exit(1);
  }
}

runTest();