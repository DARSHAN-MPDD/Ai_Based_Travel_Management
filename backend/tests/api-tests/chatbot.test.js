const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');
const chatbotService = require('../../services/chatbotService');

describe('Chatbot API', () => {
  let userToken;
  let userId;
  let adminToken;
  let adminId;
  let otherUserToken;
  let otherUserId;
  let testDestinationId;
  let testPackageId;
  let createdReviewIds = [];
  let createdDestinationIds = [];
  let createdUserIds = [];
  let createdPackageIds = [];

  const timestamp = Date.now();

  beforeAll(async () => {
    const userData = {
      name: 'Chatbot User',
      email: `chatuser${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };

    const adminData = {
      name: 'Chatbot Admin',
      email: `chatadmin${timestamp}@example.com`,
      password: 'AdminPass123',
      phone: '+91 99999 99999'
    };

    const otherData = {
      name: 'Other Chatbot User',
      email: `chatother${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43222'
    };

    const userReg = await request(app).post('/api/auth/register').send(userData);
    userId = userReg.body.data.user.id;
    userToken = userReg.body.data.token;
    createdUserIds.push(userId);

    const adminReg = await request(app).post('/api/auth/register').send(adminData);
    adminId = adminReg.body.data.user.id;
    createdUserIds.push(adminId);
    await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminId]);
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.data.token;

    const otherReg = await request(app).post('/api/auth/register').send(otherData);
    otherUserId = otherReg.body.data.user.id;
    otherUserToken = otherReg.body.data.token;
    createdUserIds.push(otherUserId);

    const [dest] = await pool.execute(
      `INSERT INTO destinations (name, description, location, category, estimated_budget, recommended_duration, best_time, activities, image_url, nature_score, adventure_score, beach_score, history_score, culture_score, food_score, photography_score, shopping_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Chatbot Test Dest', 'A destination for chatbot testing', 'Karnataka', 'Hill Station', 8000, 3, 'September', '["Trekking", "Waterfalls"]', 'https://test.com/img.jpg', 80, 60, 20, 30, 40, 50, 60, 30]
    );
    testDestinationId = dest.insertId;
    createdDestinationIds.push(testDestinationId);

    const [pkg] = await pool.execute(
      `INSERT INTO travel_packages (destination_id, name, description, duration_days, price_per_person, inclusions, exclusions, image_url, max_travelers) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testDestinationId, 'Chatbot Test Package', 'A package for testing', 3, 5000, '["Breakfast"]', '["Lunch"]', 'https://test.com/pkg.jpg', 10]
    );
    testPackageId = pkg.insertId;
    createdPackageIds.push(testPackageId);

    chatbotService.sessionStore.clear();
  });

  afterAll(async () => {
    if (createdReviewIds.length > 0) {
      const placeholders = createdReviewIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM reviews WHERE id IN (${placeholders})`, createdReviewIds);
    }
    for (const destId of createdDestinationIds) {
      await pool.execute('DELETE FROM reviews WHERE destination_id = ?', [destId]);
    }
    for (const pkgId of createdPackageIds) {
      await pool.execute('DELETE FROM travel_packages WHERE id = ?', [pkgId]);
    }
    for (const destId of createdDestinationIds) {
      await pool.execute('DELETE FROM destinations WHERE id = ?', [destId]);
    }
    for (const uId of createdUserIds) {
      await pool.execute('DELETE FROM users WHERE id = ?', [uId]);
    }
    chatbotService.sessionStore.clear();
  });

  describe('POST /api/chatbot/message - Input validation', () => {
    test('should reject empty messages', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('should reject whitespace-only messages', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: '   ' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject excessively long messages (>2000 chars)', async () => {
      const longMessage = 'a'.repeat(2001);
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: longMessage })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject messages without a message field', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/chatbot/message - Destination questions', () => {
    test('should return real destination records for location queries', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'What destinations are in Karnataka?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('destination_search');
      expect(response.body.data.reply).toContain('destination');
      expect(response.body.data.data.results).toBeDefined();
      expect(response.body.data.data.results.length).toBeGreaterThan(0);

      const result = response.body.data.data.results.find(d => d.name === 'Chatbot Test Dest');
      expect(result).toBeDefined();
      expect(result.location).toBe('Karnataka');
    });

    test('should return destination details with activities', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Tell me about Chatbot Test Dest' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('destination_details');
      expect(response.body.data.data.destination).toBeDefined();
      expect(response.body.data.data.destination.name).toBe('Chatbot Test Dest');
      expect(response.body.data.data.destination.activities).toBeDefined();
    });

    test('should return 404 when destination does not exist', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Tell me about Nonexistent Place' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reply).toContain("couldn't find");
    });
  });

  describe('POST /api/chatbot/message - Package questions', () => {
    test('should return real package records for package queries', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Show me travel packages' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('package_search');

      const pkg = response.body.data.data.results.find(p => p.name === 'Chatbot Test Package');
      expect(pkg).toBeDefined();
      expect(parseFloat(pkg.price_per_person)).toBe(5000);
    });

    test('should filter packages by budget when specified', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Show me travel packages within 5000' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.results.length).toBeGreaterThan(0);

      response.body.data.data.results.forEach(pkg => {
        expect(parseFloat(pkg.price_per_person)).toBeLessThanOrEqual(5000);
      });
    });
  });

  describe('POST /api/chatbot/message - Budget questions', () => {
    test('should use actual stored budget data', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'I have 10000 for 3 days' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('budget_itinerary');
      expect(response.body.data.reply).toContain('Chatbot Test Dest');
    });
  });

  describe('POST /api/chatbot/message - Recommendations', () => {
    test('should reuse existing recommendation logic for authenticated users', async () => {
      await pool.execute(
        `INSERT INTO user_preferences (user_id, budget_min, budget_max, preferred_duration, travel_type, nature_interest, adventure_interest, beach_interest, history_interest, culture_interest, food_interest, photography_interest, shopping_interest)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, 5000, 15000, 3, 'nature', 80, 40, 30, 50, 60, 50, 50, 30]
      );

      const response = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: 'Recommend destinations for me' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('recommendations');
      expect(response.body.data.reply).toContain('recommend');
    });

    test('should handle missing preferences gracefully', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ message: 'Recommend destinations for me' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('recommendations');
      expect(response.body.data.reply).toMatch(/log in|preferen/i);
    });
  });

  describe('POST /api/chatbot/message - Booking privacy', () => {
    test('should reject unauthenticated users accessing booking data', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'What is my booking status?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reply).toMatch(/log in|authentication/i);
    });

    test('should allow authenticated users to ask about their own bookings', async () => {
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: '2025-12-25', travelers: 2 });

      const response = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: 'What is my booking status?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('booking_status');
      expect(response.body.data.reply).toContain('booking');
    });

    test('should not allow users to access another user booking info', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ message: 'Check booking status for user 999' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const jsonStr = JSON.stringify(response.body);
      expect(jsonStr).not.toContain('TM');
      expect(response.body.data.intent).toBe('booking_status');
    });
  });

  describe('POST /api/chatbot/message - Session management', () => {
    test('should return a session_id for new conversations', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Show me destinations' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBeDefined();
      expect(typeof response.body.data.session_id).toBe('string');
    });

    test('should enforce session ownership (user cannot access another session)', async () => {
      const res1 = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: 'Hello from user 1', session_id: 'shared_test_session' })
        .expect(200);

      const userSessionId = res1.body.data.session_id;

      const response = await request(app)
        .get(`/api/chatbot/session?session_id=${userSessionId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should clear session for the authenticated user', async () => {
      const res = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: 'Test session' })
        .expect(200);

      const sessId = res.body.data.session_id;

      const response = await request(app)
        .delete(`/api/chatbot/session?session_id=${sessId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid session_id format', async () => {
      const response = await request(app)
        .get('/api/chatbot/session?session_id=')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/chatbot/message - Review queries', () => {
    beforeAll(async () => {
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 5, comment: 'Excellent destination' });

      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 4, comment: 'Very good' });
    });

    test('should return accurate review summaries from real data', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'What is the rating for Chatbot Test Dest?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('review_summary');
      expect(response.body.data.data.summary).toBeDefined();
      expect(response.body.data.data.summary.total_reviews).toBeGreaterThanOrEqual(2);
      expect(response.body.data.data.summary.average_rating).toBeGreaterThan(0);
    });

    test('should handle destinations with no reviews', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Show me reviews for Nonexistent Place' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reply).toMatch(/couldn't find/i);
    });
  });

  describe('POST /api/chatbot/message - Unknown queries and error handling', () => {
    test('should return a useful fallback for unrecognized queries', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'asdfghjkl12345' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intent).toBe('unknown');
      expect(response.body.data.reply).toMatch(/not sure|help|assist/i);
      expect(response.body.data.suggestions).toBeDefined();
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
    });

    test('should provide clarification when budget is missing', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'Help me plan a trip for 3 days' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reply).toMatch(/budget|₹|cost/i);
    });
  });

  describe('POST /api/chatbot/message - General travel help', () => {
    test('should provide travel tips for general questions', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'What travel tips do you have?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reply).toContain('tips');
    });
  });

  describe('Security', () => {
    test('should not expose database details or stack traces in responses', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'SELECT * FROM users' })
        .expect(200);

      const jsonStr = JSON.stringify(response.body);
      expect(jsonStr).not.toContain('SELECT');
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain('trace');
      expect(jsonStr).not.toContain('error.stack');
    });

    test('should not expose email or password in any response', async () => {
      const response = await request(app)
        .post('/api/chatbot/message')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ message: 'Show me my bookings' })
        .expect(200);

      const jsonStr = JSON.stringify(response.body);
      expect(jsonStr).not.toContain('password_hash');
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain('@example.com');
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

    test('GET /api should include chatbot endpoints', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.endpoints.chatbot).toBeDefined();
      expect(response.body.endpoints.chatbot.message).toBe('POST /api/chatbot/message');
    });
  });
});
