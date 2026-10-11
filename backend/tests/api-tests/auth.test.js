const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { pool } = require('../../config/database');

describe('Authentication API', () => {
  let testUserData;
  let authToken;
  let userId;

  beforeAll(() => {
    testUserData = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };
  });

  afterAll(async () => {
    if (userId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUserData.email.toLowerCase());
      expect(response.body.data.user.name).toBe(testUserData.name);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password_hash).toBeUndefined();
      expect(response.body.data.user.password).toBeUndefined();

      userId = response.body.data.user.id;
      authToken = response.body.data.token;
    });

    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: 'invalid-email',
          password: 'TestPass123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: `short${Date.now()}@example.com`,
          password: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email already registered');
    });

    test('should store password as bcrypt hash', async () => {
      const [users] = await pool.execute(
        'SELECT password_hash FROM users WHERE email = ?',
        [testUserData.email.toLowerCase()]
      );

      expect(users.length).toBe(1);
      const hash = users[0].password_hash;
      expect(hash).toBeDefined();
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')).toBe(true);

      const isValid = await bcrypt.compare(testUserData.password, hash);
      expect(isValid).toBe(true);
    });

    test('should not allow public registration to assign ADMIN role', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUserData,
          email: `admin${Date.now()}@example.com`,
          role: 'admin'
        })
        .expect(201);

      expect(response.body.data.user.role).toBe('user');

      const [users] = await pool.execute(
        'SELECT role FROM users WHERE email = ?',
        [response.body.data.user.email]
      );
      expect(users[0].role).toBe('user');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUserData.email.toLowerCase());
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password_hash).toBeUndefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    test('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserData.email,
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with unknown email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });

    test('should reject request with expired token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../../config');
      const expiredToken = jwt.sign(
        { id: userId, role: 'user' },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Token expired');
    });

    test('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe(testUserData.email.toLowerCase());
      expect(response.body.data.user.password_hash).toBeUndefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    test('should not expose password hash in any response', async () => {
      const responses = [
        await request(app).post('/api/auth/register').send({
          name: 'Another User',
          email: `another${Date.now()}@example.com`,
          password: 'TestPass123'
        }),
        await request(app).post('/api/auth/login').send({
          email: testUserData.email,
          password: testUserData.password
        }),
        await request(app).get('/api/auth/me').set('Authorization', `Bearer ${authToken}`)
      ];

      responses.forEach(response => {
        if (response.body.data?.user) {
          expect(response.body.data.user.password_hash).toBeUndefined();
          expect(response.body.data.user.password).toBeUndefined();
        }
        if (response.body.data?.token) {
          expect(typeof response.body.data.token).toBe('string');
        }
      });
    });
  });

  describe('Existing endpoints still work', () => {
    test('GET /api/health should work', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(res => {
          expect([200, 503]).toContain(res.status);
        });
    });

    test('GET /api should work', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.endpoints.auth.register).toBe('POST /api/auth/register');
      expect(response.body.endpoints.auth.login).toBe('POST /api/auth/login');
      expect(response.body.endpoints.auth.me).toBe('GET /api/auth/me');
    });
  });
});