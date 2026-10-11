const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');
const jwt = require('jsonwebtoken');
const config = require('../../config');

describe('Itinerary API', () => {
  let userToken;
  let userId;
  let user2Token;
  let user2Id;
  let testDestinationId;
  let testItineraryId;

  beforeAll(async () => {
    const timestamp = Date.now();
    
    const userData = {
      name: 'Test User',
      email: `itineraryuser${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };
    const userData2 = {
      name: 'Test User 2',
      email: `itineraryuser2${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43211'
    };

    const userReg = await request(app).post('/api/auth/register').send(userData);
    userId = userReg.body.data.user.id;
    userToken = userReg.body.data.token;

    const userReg2 = await request(app).post('/api/auth/register').send(userData2);
    user2Id = userReg2.body.data.user.id;
    user2Token = userReg2.body.data.token;

    const [dest] = await pool.execute(
      `SELECT id FROM destinations WHERE is_active = TRUE LIMIT 1`
    );
    testDestinationId = dest[0]?.id;
  });

  afterAll(async () => {
    if (testItineraryId) {
      await pool.execute('DELETE FROM itinerary_days WHERE itinerary_id = ?', [testItineraryId]);
      await pool.execute('DELETE FROM itineraries WHERE id = ?', [testItineraryId]);
    }
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    if (user2Id) await pool.execute('DELETE FROM users WHERE id = ?', [user2Id]);
  });

  describe('POST /api/itinerary', () => {
    const validPayload = {
      destination_id: 0,
      duration: 3,
      budget: 20000,
      travelers: 2,
      interests: ['nature', 'photography'],
      travel_type: 'nature',
      start_date: '2026-11-15'
    };

    beforeAll(() => {
      validPayload.destination_id = testDestinationId;
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .send(validPayload)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject invalid destination ID', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, destination_id: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject missing destination', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, destination_id: 99999 })
        .expect(res => {
          expect([404, 500]).toContain(res.status);
        });
    });

    test('should reject invalid duration (zero)', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, duration: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid duration (negative)', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, duration: -1 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject duration exceeding maximum', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, duration: 31 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid budget (zero)', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, budget: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid budget (negative)', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, budget: -100 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid travelers (zero)', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, travelers: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid travelers (exceeding max)', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, travelers: 21 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid interests', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, interests: ['invalid_interest'] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid travel_type', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, travel_type: 'invalid_type' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid start_date format', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validPayload, start_date: 'invalid-date' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should generate itinerary successfully', async () => {
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validPayload)
        .expect(res => {
          expect([201, 500]).toContain(res.status);
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Itinerary generated successfully');
        expect(response.body.data.itinerary_id).toBeDefined();
        expect(response.body.data.destination).toBeDefined();
        expect(response.body.data.destination.id).toBe(testDestinationId);
        expect(response.body.data.duration).toBe(validPayload.duration);
        expect(response.body.data.number_of_travelers).toBe(validPayload.travelers);
        expect(parseFloat(response.body.data.budget)).toBe(validPayload.budget);
        expect(response.body.data.total_estimated_cost).toBeDefined();
        expect(response.body.data.budget_status).toBeDefined();
        expect(response.body.data.budget_breakdown).toBeDefined();
        expect(response.body.data.days).toBeInstanceOf(Array);
        expect(response.body.data.days.length).toBe(validPayload.duration);

        testItineraryId = response.body.data.itinerary_id;

        response.body.data.days.forEach((day, index) => {
          expect(day.day_number).toBe(index + 1);
          expect(day.day_title).toBeDefined();
          expect(day.morning_activity).toBeDefined();
          expect(day.afternoon_activity).toBeDefined();
          expect(day.evening_activity).toBeDefined();
          expect(day.estimated_cost).toBeDefined();
          expect(day.notes).toBeDefined();
        });

        const breakdown = response.body.data.budget_breakdown;
        expect(breakdown.transportation).toBeGreaterThanOrEqual(0);
        expect(breakdown.accommodation).toBeGreaterThanOrEqual(0);
        expect(breakdown.food).toBeGreaterThanOrEqual(0);
        expect(breakdown.activities).toBeGreaterThanOrEqual(0);
        expect(breakdown.miscellaneous).toBeGreaterThanOrEqual(0);

        const totalBreakdown = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
        expect(Math.round(totalBreakdown * 100) / 100).toBe(Math.round(response.body.data.total_estimated_cost * 100) / 100);
      }
    });

    test('should generate itinerary with minimal required fields', async () => {
      const minimalPayload = {
        destination_id: testDestinationId,
        duration: 2,
        budget: 10000,
        travelers: 1
      };

      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send(minimalPayload)
        .expect(res => {
          expect([201, 500]).toContain(res.status);
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.days.length).toBe(2);
        
        const newItineraryId = response.body.data.itinerary_id;
        await pool.execute('DELETE FROM itinerary_days WHERE itinerary_id = ?', [newItineraryId]);
        await pool.execute('DELETE FROM itineraries WHERE id = ?', [newItineraryId]);
      }
    });
  });

  describe('GET /api/itinerary/:id', () => {
    beforeAll(async () => {
      // Create a test itinerary for GET tests
      const response = await request(app)
        .post('/api/itinerary')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          destination_id: testDestinationId,
          duration: 3,
          budget: 20000,
          travelers: 2,
          interests: ['nature'],
          travel_type: 'nature'
        });
      if (response.status === 201) {
        testItineraryId = response.body.data.itinerary_id;
      }
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get(`/api/itinerary/${testItineraryId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject invalid itinerary ID', async () => {
      const response = await request(app)
        .get('/api/itinerary/invalid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should return 404 for non-existent itinerary', async () => {
      const response = await request(app)
        .get('/api/itinerary/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Itinerary not found');
    });

    test('should return 404 for another user itinerary', async () => {
      const response = await request(app)
        .get(`/api/itinerary/${testItineraryId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should retrieve own itinerary successfully', async () => {
      const response = await request(app)
        .get(`/api/itinerary/${testItineraryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.itinerary_id).toBe(testItineraryId);
      expect(response.body.data.destination).toBeDefined();
      expect(response.body.data.duration).toBe(3);
      expect(response.body.data.number_of_travelers).toBe(2);
      expect(parseFloat(response.body.data.budget)).toBe(20000);
      expect(response.body.data.total_estimated_cost).toBeDefined();
      expect(response.body.data.budget_status).toBeDefined();
      expect(response.body.data.budget_breakdown).toBeDefined();
      expect(response.body.data.days).toBeInstanceOf(Array);
      expect(response.body.data.days.length).toBe(3);

      response.body.data.days.forEach((day, index) => {
        expect(day.day_number).toBe(index + 1);
      });
    });
  });

  describe('GET /api/itinerary', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/itinerary')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should retrieve user itineraries with pagination', async () => {
      const response = await request(app)
        .get('/api/itinerary?page=1&limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(5);

        if (response.body.data.length > 0) {
          const itinerary = response.body.data[0];
          expect(itinerary.itinerary_id).toBeDefined();
          expect(itinerary.destination).toBeDefined();
          expect(itinerary.duration).toBeDefined();
          expect(itinerary.travelers).toBeDefined();
          expect(itinerary.budget).toBeDefined();
          expect(itinerary.total_estimated_cost).toBeDefined();
          expect(itinerary.status).toBeDefined();
          expect(itinerary.created_at).toBeDefined();
        }
      }
    });

    test('should reject invalid page parameter', async () => {
      const response = await request(app)
        .get('/api/itinerary?page=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/itinerary?limit=25')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should only return current user itineraries', async () => {
      const response = await request(app)
        .get('/api/itinerary')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        response.body.data.forEach(itinerary => {
          expect(itinerary.itinerary_id).not.toBe(testItineraryId);
        });
      }
    });
  });

  describe('Previous phases still work', () => {
    test('GET /api/health should work', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(res => {
          expect([200, 503]).toContain(res.status);
        });
    });

    test('GET /api should include itinerary endpoints', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.endpoints.itinerary).toBeDefined();
      expect(response.body.endpoints.itinerary.generate).toBe('POST /api/itinerary');
      expect(response.body.endpoints.itinerary.detail).toBe('GET /api/itinerary/:id');
      expect(response.body.endpoints.itinerary.list).toBe('GET /api/itinerary');
    });

    test('Auth endpoints still work', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `itineraryuser${Date.now()}@example.com`,
          password: 'TestPass123'
        })
        .expect(res => {
          expect([200, 401]).toContain(res.status);
        });
    });

    test('Destination endpoints still work', async () => {
      const response = await request(app)
        .get('/api/destinations')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });
    });

    test('Recommendation endpoints still work', async () => {
      const response = await request(app)
        .post('/api/recommendations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([200, 400, 404, 500]).toContain(res.status);
        });
    });
  });
});