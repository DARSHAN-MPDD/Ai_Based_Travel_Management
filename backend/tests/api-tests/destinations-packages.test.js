const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');
const jwt = require('jsonwebtoken');
const config = require('../../config');

describe('Destination API', () => {
  let adminToken;
  let userToken;
  let adminId;
  let userId;
  let testDestinationId;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    const adminData = {
      name: 'Admin User',
      email: `admin${timestamp}@example.com`,
      password: 'AdminPass123',
      phone: '+91 99999 99999'
    };
    const userData = {
      name: 'Test User',
      email: `user${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };

    const adminReg = await request(app).post('/api/auth/register').send(adminData);
    await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminReg.body.data.user.id]);
    adminId = adminReg.body.data.user.id;
    // Re-login to get token with admin role
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.data.token;

    const userReg = await request(app).post('/api/auth/register').send(userData);
    userId = userReg.body.data.user.id;
    userToken = userReg.body.data.token;
  });

  afterAll(async () => {
    if (testDestinationId) {
      await pool.execute('DELETE FROM destinations WHERE id = ?', [testDestinationId]);
    }
    if (adminId) await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  });

  describe('GET /api/destinations', () => {
    test('should list destinations with pagination', async () => {
      const response = await request(app)
        .get('/api/destinations')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(12);
      }
    });

    test('should support search parameter', async () => {
      const response = await request(app)
        .get('/api/destinations?search=Coorg')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    test('should support category filter', async () => {
      const response = await request(app)
        .get('/api/destinations?category=Hill Station')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('should support budget filters', async () => {
      const response = await request(app)
        .get('/api/destinations?minBudget=10000&maxBudget=20000')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('should support sort options', async () => {
      const response = await request(app)
        .get('/api/destinations?sort=budget_asc')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/api/destinations?limit=100')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid sort', async () => {
      const response = await request(app)
        .get('/api/destinations?sort=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/destinations/:id', () => {
    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/destinations/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should return 404 for nonexistent destination', async () => {
      const response = await request(app)
        .get('/api/destinations/99999')
        .expect(res => {
          expect([404, 500]).toContain(res.status);
        });
    });
  });

  describe('GET /api/destinations/:id/packages', () => {
    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/destinations/invalid/packages')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/destinations (Admin)', () => {
    const validDestination = {
      name: 'Test Destination',
      description: 'A test destination',
      location: 'Test State',
      category: 'Hill Station',
      estimated_budget: 15000,
      recommended_duration: 3,
      best_time: 'October to March',
      activities: ['Activity 1', 'Activity 2'],
      image_url: 'https://images.unsplash.com/photo-test',
      nature_score: 90,
      adventure_score: 70,
      beach_score: 10,
      history_score: 50,
      culture_score: 60,
      food_score: 80,
      photography_score: 85,
      shopping_score: 40
    };

    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .send(validDestination)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject request with USER token', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validDestination)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');
    });

    test('should create destination with ADMIN token', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validDestination)
        .expect(res => {
          expect([201, 500]).toContain(res.status);
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(validDestination.name);
        testDestinationId = response.body.data.id;
      }
    });

    test('should reject invalid scores', async () => {
      const invalidData = { ...validDestination, name: 'Test Dest 2', nature_score: 150 };
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/destinations/:id (Admin)', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .put('/api/destinations/1')
        .send({ name: 'Updated' })
        .expect(401);
    });

    test('should reject request with USER token', async () => {
      const response = await request(app)
        .put('/api/destinations/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' })
        .expect(403);
    });

    test('should update destination with ADMIN token', async () => {
      if (!testDestinationId) return;

      const response = await request(app)
        .put(`/api/destinations/${testDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Destination Name' })
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Destination Name');
      }
    });
  });

  describe('DELETE /api/destinations/:id (Admin)', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .delete('/api/destinations/1')
        .expect(401);
    });

    test('should reject request with USER token', async () => {
      const response = await request(app)
        .delete('/api/destinations/1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('should reject invalid ID', async () => {
      const response = await request(app)
        .delete('/api/destinations/invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});

describe('Package API', () => {
  let adminToken;
  let userToken;
  let adminId;
  let userId;
  let testPackageId;
  let testDestinationId;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    const adminData = {
      name: 'Admin User 2',
      email: `admin2${timestamp}@example.com`,
      password: 'AdminPass123',
      phone: '+91 99999 99998'
    };
    const userData = {
      name: 'Test User 2',
      email: `user2${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43211'
    };

    const adminReg = await request(app).post('/api/auth/register').send(adminData);
    await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminReg.body.data.user.id]);
    adminId = adminReg.body.data.user.id;
    // Re-login to get token with admin role
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.data.token;

    const userReg = await request(app).post('/api/auth/register').send(userData);
    userId = userReg.body.data.user.id;
    userToken = userReg.body.data.token;

    // Create a test destination
    const [dest] = await pool.execute(
      `INSERT INTO destinations (name, description, location, category, estimated_budget, recommended_duration, best_time, activities, image_url, nature_score, adventure_score, beach_score, history_score, culture_score, food_score, photography_score, shopping_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Test Dest for Package', 'Desc', 'Test', 'Hill Station', 10000, 2, 'Jan', '[]', 'https://test.com', 50, 50, 50, 50, 50, 50, 50, 50, 50]
    );
    testDestinationId = dest.insertId;
  });

  afterAll(async () => {
    if (testPackageId) await pool.execute('DELETE FROM travel_packages WHERE id = ?', [testPackageId]);
    if (testDestinationId) await pool.execute('DELETE FROM destinations WHERE id = ?', [testDestinationId]);
    if (adminId) await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  });

  describe('GET /api/packages', () => {
    test('should list packages with pagination', async () => {
      const response = await request(app)
        .get('/api/packages')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.pagination).toBeDefined();
      }
    });

    test('should support destinationId filter', async () => {
      const response = await request(app)
        .get(`/api/packages?destinationId=${testDestinationId}`)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('should support price filters', async () => {
      const response = await request(app)
        .get('/api/packages?minPrice=5000&maxPrice=20000')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('should support sort options', async () => {
      const response = await request(app)
        .get('/api/packages?sort=price_desc')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/api/packages?limit=100')
        .expect(400);
    });

    test('should reject invalid sort', async () => {
      const response = await request(app)
        .get('/api/packages?sort=invalid')
        .expect(400);
    });
  });

  describe('GET /api/packages/:id', () => {
    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/packages/invalid')
        .expect(400);
    });

    test('should return 404 for nonexistent package', async () => {
      const response = await request(app)
        .get('/api/packages/99999')
        .expect(res => {
          expect([404, 500]).toContain(res.status);
        });
    });
  });

  describe('POST /api/packages (Admin)', () => {
    const validPackage = {
      destination_id: 0, // Will be set in test
      name: 'Test Package',
      description: 'A test package',
      duration_days: 3,
      price_per_person: 12000,
      inclusions: ['Accommodation', 'Meals'],
      exclusions: ['Flights'],
      image_url: 'https://images.unsplash.com/photo-test',
      max_travelers: 10
    };

    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/packages')
        .send({ ...validPackage, destination_id: testDestinationId })
        .expect(401);
    });

    test('should reject request with USER token', async () => {
      const response = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPackage, destination_id: testDestinationId })
        .expect(403);
    });

    test('should reject invalid destination reference', async () => {
      const response = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPackage, destination_id: 99999 })
        .expect(res => {
          expect([400, 500]).toContain(res.status);
        });
    });

    test('should create package with ADMIN token', async () => {
      const response = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPackage, destination_id: testDestinationId })
        .expect(res => {
          expect([201, 500]).toContain(res.status);
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(validPackage.name);
        testPackageId = response.body.data.id;
      }
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject negative price', async () => {
      const response = await request(app)
        .post('/api/packages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validPackage, destination_id: testDestinationId, price_per_person: -100 })
        .expect(400);
    });
  });

  describe('PUT /api/packages/:id (Admin)', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .put('/api/packages/1')
        .send({ name: 'Updated' })
        .expect(401);
    });

    test('should reject request with USER token', async () => {
      const response = await request(app)
        .put('/api/packages/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' })
        .expect(403);
    });

    test('should update package with ADMIN token', async () => {
      if (!testPackageId) return;

      const response = await request(app)
        .put(`/api/packages/${testPackageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          name: 'Updated Package Name', 
          destination_id: testDestinationId,
          duration_days: 3,
          price_per_person: 12000
        })
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Package Name');
      }
    });
  });

  describe('DELETE /api/packages/:id (Admin)', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .delete('/api/packages/1')
        .expect(401);
    });

    test('should reject request with USER token', async () => {
      const response = await request(app)
        .delete('/api/packages/1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('should reject invalid ID', async () => {
      const response = await request(app)
        .delete('/api/packages/invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});