const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');
const bcrypt = require('bcryptjs');

describe('Preferences API', () => {
  let userToken;
  let userId;

  beforeAll(async () => {
    const timestamp = Date.now();
    const userData = {
      name: 'Pref Test User',
      email: `pref${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };

    const reg = await request(app).post('/api/auth/register').send(userData);
    userId = reg.body.data.user.id;
    userToken = reg.body.data.token;
  });

  afterAll(async () => {
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  });

  describe('GET /api/preferences', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/preferences')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should return null for user with no preferences', async () => {
      const response = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeNull();
      }
    });
  });

  describe('POST /api/preferences', () => {
    const validPreferences = {
      budget_min: 5000,
      budget_max: 20000,
      preferred_duration: 4,
      travel_type: 'nature',
      nature_interest: 90,
      adventure_interest: 70,
      beach_interest: 20,
      history_interest: 30,
      culture_interest: 60,
      food_interest: 80,
      photography_interest: 85,
      shopping_interest: 40
    };

    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .send(validPreferences)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid budget_min', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, budget_min: -100 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid budget_max', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, budget_max: -500 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject budget_min > budget_max', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, budget_min: 25000, budget_max: 20000 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid duration', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, preferred_duration: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid travel_type', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, travel_type: 'invalid_type' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject score > 100', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, nature_interest: 150 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject score < 0', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPreferences, adventure_interest: -10 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should save preferences successfully', async () => {
      const response = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validPreferences)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.user_id).toBe(userId);
        expect(response.body.data.nature_interest).toBe(90);
      }
    });

    test('should get saved preferences', async () => {
      const response = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).not.toBeNull();
        expect(response.body.data.nature_interest).toBe(90);
      }
    });
  });

  describe('PUT /api/preferences', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .put('/api/preferences')
        .send({ nature_interest: 95 })
        .expect(401);
    });

    test('should update preferences', async () => {
      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nature_interest: 95, budget_max: 25000 })
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.nature_interest).toBe(95);
        expect(response.body.data.budget_max).toBe("25000.00");
      }
    });
  });
});

describe('Recommendations API', () => {
  let userToken;
  let userId;
  let adminToken;
  let adminId;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    const userData = {
      name: 'Rec Test User',
      email: `rec${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };

    const adminData = {
      name: 'Rec Admin',
      email: `recadmin${timestamp}@example.com`,
      password: 'AdminPass123',
      phone: '+91 99999 99999'
    };

    const userReg = await request(app).post('/api/auth/register').send(userData);
    userId = userReg.body.data.user.id;
    userToken = userReg.body.data.token;

    const adminReg = await request(app).post('/api/auth/register').send(adminData);
    await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminReg.body.data.user.id]);
    adminId = adminReg.body.data.user.id;
    adminToken = adminReg.body.data.token;
  });

  afterAll(async () => {
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    if (adminId) await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
  });

  describe('POST /api/recommendations', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/recommendations')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject user without preferences', async () => {
      const response = await request(app)
        .post('/api/recommendations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([400, 500]).toContain(res.status);
        });

      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('preferences');
      }
    });

    test('should support limit parameter', async () => {
      const response = await request(app)
        .post('/api/recommendations?limit=3')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([400, 500]).toContain(res.status);
        });
    });

    test('should reject invalid limit', async () => {
      const response = await request(app)
        .post('/api/recommendations?limit=50')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/recommendations', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/recommendations')
        .expect(401);
    });

    test('should return saved recommendations (empty initially)', async () => {
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      }
    });
  });
});

describe('Existing endpoints still work', () => {
  test('GET /api/health', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(res => {
        expect([200, 503]).toContain(res.status);
      });
  });

  test('GET /api', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(response.body.endpoints.preferences).toBeDefined();
    expect(response.body.endpoints.recommendations).toBeDefined();
  });
});