const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');

describe('Review API', () => {
  let userToken;
  let userId;
  let adminToken;
  let adminId;
  let otherUserToken;
  let otherUserId;
  let testDestinationId;
  let otherDestinationId;
  let createdReviewIds = [];
  let createdDestinationIds = [];
  let createdUserIds = [];

  const timestamp = Date.now();

  const getReviewSummary = async (destinationId) => {
    const res = await request(app).get(`/api/reviews/${destinationId}/summary`);
    return res.body;
  };

  beforeAll(async () => {
    const userData = {
      name: 'Review User',
      email: `reviewuser${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };

    const adminData = {
      name: 'Review Admin',
      email: `reviewadmin${timestamp}@example.com`,
      password: 'AdminPass123',
      phone: '+91 99999 99999'
    };

    const otherData = {
      name: 'Other Review User',
      email: `reviewother${timestamp}@example.com`,
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
      ['Review Test Dest', 'Test destination for reviews', 'Test Location', 'Hill Station', 15000, 3, 'Jan', '[]', 'https://test.com', 50, 50, 50, 50, 50, 50, 50, 50]
    );
    testDestinationId = dest.insertId;
    createdDestinationIds.push(testDestinationId);

    const [dest2] = await pool.execute(
      `INSERT INTO destinations (name, description, location, category, estimated_budget, recommended_duration, best_time, activities, image_url, nature_score, adventure_score, beach_score, history_score, culture_score, food_score, photography_score, shopping_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Empty Reviews Dest', 'No reviews here', 'Another Location', 'Beach', 10000, 2, 'Feb', '[]', 'https://test.com', 50, 50, 50, 50, 50, 50, 50, 50]
    );
    otherDestinationId = dest2.insertId;
    createdDestinationIds.push(otherDestinationId);
  });

  afterAll(async () => {
    if (createdReviewIds.length > 0) {
      const placeholders = createdReviewIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM reviews WHERE id IN (${placeholders})`, createdReviewIds);
    }
    for (const destId of createdDestinationIds) {
      await pool.execute('DELETE FROM reviews WHERE destination_id = ?', [destId]);
    }
    for (const destId of createdDestinationIds) {
      await pool.execute('DELETE FROM destinations WHERE id = ?', [destId]);
    }
    for (const uId of createdUserIds) {
      await pool.execute('DELETE FROM users WHERE id = ?', [uId]);
    }
  });

  describe('POST /api/reviews - Authentication', () => {
    test('should reject unauthenticated review submission', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .send({ destination_id: testDestinationId, rating: 5, comment: 'Great place!' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ destination_id: testDestinationId, rating: 5, comment: 'Great place!' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });
  });

  describe('POST /api/reviews - Validation', () => {
    test('should reject rating below 1', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 0, comment: 'Too low rating' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject rating above 5', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 6, comment: 'Too high rating' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid destination ID', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: -1, rating: 5, comment: 'Valid comment' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 404 for nonexistent destination', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: 999999, rating: 5, comment: 'Valid comment' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Destination not found');
    });

    test('should reject empty comment', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 5, comment: '   ' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject excessively long comment', async () => {
      const longComment = 'x'.repeat(2001);
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 5, comment: longComment })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject missing rating', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, comment: 'Valid comment' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject missing destination_id', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Valid comment' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/reviews - Successful creation', () => {
    test('should create a valid review and return 201', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 5, comment: 'Amazing destination!', title: 'Wonderful' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.comment).toBe('Amazing destination!');
      expect(response.body.data.user_name).toBe('Review User');
      expect(response.body.data.user_id).toBe(userId);
      createdReviewIds.push(response.body.data.id);
    });

    test('should never accept user ID or role from request body', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          destination_id: testDestinationId,
          rating: 4,
          comment: 'Good place',
          user_id: 999,
          role: 'admin'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.user_id).not.toBe(999);
      createdReviewIds.push(response.body.data.id);
    });

    test('should allow title to be optional', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 3, comment: 'Okay experience' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBeNull();
      createdReviewIds.push(response.body.data.id);
    });
  });

  describe('GET /api/reviews/:destinationId - Listing', () => {
    test('should return reviews with only public information', async () => {
      const response = await request(app)
        .get(`/api/reviews/${testDestinationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const review = response.body.data[0];
      expect(review.user_name).toBeDefined();
      expect(review.rating).toBeDefined();
      expect(review.comment).toBeDefined();
      expect(review.email).toBeUndefined();
      expect(review.password_hash).toBeUndefined();
    });

    test('should order reviews by most recent first', async () => {
      const response = await request(app)
        .get(`/api/reviews/${testDestinationId}`)
        .expect(200);

      const dates = response.body.data.map(r => new Date(r.created_at));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i].getTime()).toBeLessThanOrEqual(dates[i - 1].getTime());
      }
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/reviews/${testDestinationId}?page=1&limit=2`)
        .expect(200);

      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBeGreaterThan(0);
      expect(response.body.pagination.totalPages).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    test('should cap page size at 50', async () => {
      const response = await request(app)
        .get(`/api/reviews/${testDestinationId}?limit=100`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(50);
    });

    test('should return 404 for nonexistent destination', async () => {
      const response = await request(app)
        .get('/api/reviews/999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Destination not found');
    });

    test('should return empty list for destination with no reviews', async () => {
      const response = await request(app)
        .get(`/api/reviews/${otherDestinationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('GET /api/reviews/:destinationId/summary - Statistics', () => {
    test('should return accurate average rating and distribution', async () => {
      const response = await request(app)
        .get(`/api/reviews/${testDestinationId}/summary`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.destination_id).toBe(testDestinationId);
      expect(response.body.data.total_reviews).toBeGreaterThan(0);
      expect(response.body.data.average_rating).toBeGreaterThanOrEqual(1);
      expect(response.body.data.average_rating).toBeLessThanOrEqual(5);
      expect(response.body.data.rating_distribution).toBeDefined();
      expect(response.body.data.rating_distribution['1']).toBeDefined();
      expect(response.body.data.rating_distribution['2']).toBeDefined();
      expect(response.body.data.rating_distribution['3']).toBeDefined();
      expect(response.body.data.rating_distribution['4']).toBeDefined();
      expect(response.body.data.rating_distribution['5']).toBeDefined();
    });

    test('should handle empty-review summary correctly', async () => {
      const response = await request(app)
        .get(`/api/reviews/${otherDestinationId}/summary`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_reviews).toBe(0);
      expect(response.body.data.average_rating).toBe(0);
      expect(response.body.data.rating_distribution['1']).toBe(0);
      expect(response.body.data.rating_distribution['5']).toBe(0);
    });
  });

  describe('PUT /api/reviews/:id - Update', () => {
    let targetReviewId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 3, comment: 'Original comment', title: 'Original Title' });
      targetReviewId = response.body.data.id;
      createdReviewIds.push(targetReviewId);
    });

    test('should update own review successfully', async () => {
      const response = await request(app)
        .put(`/api/reviews/${targetReviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 4, comment: 'Updated comment', title: 'Updated Title' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(4);
      expect(response.body.data.comment).toBe('Updated comment');
      expect(response.body.data.title).toBe('Updated Title');
    });

    test('should reject editing another user review (403/404)', async () => {
      let otherReviewId;
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ destination_id: testDestinationId, rating: 2, comment: 'Other user review' });
      otherReviewId = createRes.body.data.id;
      createdReviewIds.push(otherReviewId);

      const response = await request(app)
        .put(`/api/reviews/${otherReviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Hacked comment' })
        .expect(res => {
          expect([403, 404]).toContain(res.status);
        });

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/reviews/:id - Delete', () => {
    let deleteTargetId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 2, comment: 'To be deleted' });
      deleteTargetId = response.body.data.id;
    });

    test('should delete own review successfully', async () => {
      const response = await request(app)
        .delete(`/api/reviews/${deleteTargetId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(deleteTargetId);

      const checkRes = await request(app).get(`/api/reviews/${testDestinationId}`);
      const reviewExists = checkRes.body.data.some(r => r.id === deleteTargetId);
      expect(reviewExists).toBe(false);
    });

    test('should reject deleting another user review (403/404)', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ destination_id: testDestinationId, rating: 3, comment: 'Other user review to protect' });
      const otherReviewId = createRes.body.data.id;
      createdReviewIds.push(otherReviewId);

      const response = await request(app)
        .delete(`/api/reviews/${otherReviewId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(res => {
          expect([403, 404]).toContain(res.status);
        });

      expect(response.body.success).toBe(false);
    });

    test('should return 404 for nonexistent review', async () => {
      const response = await request(app)
        .delete('/api/reviews/999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Review not found');
    });

    test('should delete a review and update summary (admin)', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 4, comment: 'Review for admin delete' });
      const reviewToDelete = createRes.body.data.id;

      const summaryBefore = await getReviewSummary(testDestinationId);
      const totalBefore = summaryBefore.data.total_reviews;

      await request(app)
        .delete(`/api/admin/reviews/${reviewToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const summaryAfter = await getReviewSummary(testDestinationId);
      const totalAfter = summaryAfter.data.total_reviews;
      expect(totalAfter).toBe(totalBefore - 1);
    });
  });

  describe('Admin moderation - Authorization', () => {
    test('should reject unauthenticated admin review access', async () => {
      const response = await request(app)
        .get('/api/admin/reviews')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject non-admin user access to admin reviews', async () => {
      const response = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');
    });

    test('should allow admin to list all reviews', async () => {
      const response = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();

      if (response.body.data.length > 0) {
        const review = response.body.data[0];
        expect(review.user_name).toBeDefined();
        expect(review.destination_name).toBeDefined();
        expect(review.rating).toBeDefined();
        expect(review.email).toBeUndefined();
      }
    });

    test('should allow admin to delete any review', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ destination_id: testDestinationId, rating: 1, comment: 'Admin delete target' });
      const targetId = createRes.body.data.id;

      const response = await request(app)
        .delete(`/api/admin/reviews/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(targetId);
    });

    test('admin reviews should support rating filter', async () => {
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ destination_id: testDestinationId, rating: 5, comment: 'Filter test review' });

      const response = await request(app)
        .get('/api/admin/reviews?rating=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(review => {
        expect(review.rating).toBe(5);
      });
    });
  });

  describe('Security', () => {
    test('should not expose email or password_hash in any review response', async () => {
      const responses = [
        await request(app).get(`/api/reviews/${testDestinationId}`),
        await request(app).get(`/api/reviews/${testDestinationId}/summary`)
      ];

      responses.forEach(res => {
        const jsonStr = JSON.stringify(res.body);
        expect(jsonStr).not.toContain('password_hash');
        expect(jsonStr).not.toContain('password');
      });

      const adminRes = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminToken}`);
      const adminJson = JSON.stringify(adminRes.body);
      expect(adminJson).not.toContain('password_hash');
      expect(adminJson).not.toContain('password');
    });

    test('should validate IDs and prevent injection in params', async () => {
      const response = await request(app)
        .get('/api/reviews/abc')
        .expect(400);

      expect(response.body.success).toBe(false);
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

    test('GET /api should work with reviews endpoints', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.endpoints.reviews).toBeDefined();
      expect(response.body.endpoints.admin.reviewsList).toBe('GET /api/admin/reviews');
      expect(response.body.endpoints.admin.reviewDelete).toBe('DELETE /api/admin/reviews/:id');
    });
  });
});
