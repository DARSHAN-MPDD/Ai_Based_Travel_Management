const { pool } = require('../config/database');

beforeAll(async () => {
  // Ensure database is available
});

afterAll(async () => {
  await pool.end();
});

global.testUser = {
  name: 'Test User',
  email: `test${Date.now()}@example.com`,
  password: 'TestPass123',
  phone: '+91 98765 43210'
};

global.adminUser = {
  name: 'Admin User',
  email: `admin${Date.now()}@example.com`,
  password: 'AdminPass123',
  phone: '+91 99999 99999'
};