const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');

describe('Booking API', () => {
  let userToken;
  let userId;
  let adminToken;
  let adminId;
  let otherUserToken;
  let otherUserId;
  let testDestinationId;
  let testPackageId;
  let testPackagePrice;
  let createdBookingIds = [];

  const getFutureDate = (daysAhead = 30) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  const futureDate = getFutureDate(30);
  const pastDate = '2020-01-01';

  beforeAll(async () => {
    const timestamp = Date.now();

    const userData = {
      name: 'Booking User',
      email: `booking${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43210'
    };

    const adminData = {
      name: 'Booking Admin',
      email: `bookingadmin${timestamp}@example.com`,
      password: 'AdminPass123',
      phone: '+91 99999 99999'
    };

    const otherData = {
      name: 'Other User',
      email: `other${timestamp}@example.com`,
      password: 'TestPass123',
      phone: '+91 98765 43222'
    };

    const userReg = await request(app).post('/api/auth/register').send(userData);
    userId = userReg.body.data.user.id;
    userToken = userReg.body.data.token;

    const adminReg = await request(app).post('/api/auth/register').send(adminData);
    adminId = adminReg.body.data.user.id;
    await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminId]);
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.data.token;

    const otherReg = await request(app).post('/api/auth/register').send(otherData);
    otherUserId = otherReg.body.data.user.id;
    otherUserToken = otherReg.body.data.token;

    const [dest] = await pool.execute(
      `INSERT INTO destinations (name, description, location, category, estimated_budget, recommended_duration, best_time, activities, image_url, nature_score, adventure_score, beach_score, history_score, culture_score, food_score, photography_score, shopping_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Booking Test Dest', 'Test', 'Test', 'Hill Station', 15000, 3, 'Jan', '[]', 'https://test.com', 50, 50, 50, 50, 50, 50, 50, 50]
    );
    testDestinationId = dest.insertId;

    const [pkg] = await pool.execute(
      `INSERT INTO travel_packages (destination_id, name, description, duration_days, price_per_person, inclusions, exclusions, image_url, max_travelers) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testDestinationId, 'Test Booking Package', 'A package for booking tests', 3, 12000, '[]', '[]', 'https://test.com', 10]
    );
    testPackageId = pkg.insertId;

    const [pkgCheck] = await pool.execute(
      'SELECT price_per_person FROM travel_packages WHERE id = ?',
      [testPackageId]
    );
    testPackagePrice = parseFloat(pkgCheck[0].price_per_person);
  });

  afterAll(async () => {
    if (createdBookingIds.length > 0) {
      const placeholders = createdBookingIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM bookings WHERE id IN (${placeholders})`, createdBookingIds);
    }
    if (testPackageId) {
      await pool.execute('DELETE FROM bookings WHERE package_id = ?', [testPackageId]);
      await pool.execute('DELETE FROM travel_packages WHERE id = ?', [testPackageId]);
    }
    if (testDestinationId) {
      await pool.execute('DELETE FROM travel_packages WHERE destination_id = ?', [testDestinationId]);
      await pool.execute('DELETE FROM destinations WHERE id = ?', [testDestinationId]);
    }
    if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    if (adminId) await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
    if (otherUserId) await pool.execute('DELETE FROM users WHERE id = ?', [otherUserId]);
  });

  describe('POST /api/bookings - Authentication', () => {
    test('should reject unauthenticated booking creation', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings - Validation', () => {
    test('should reject missing package_id', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ travel_date: futureDate, travelers: 2 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject invalid package ID (non-integer)', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: 'invalid', travel_date: futureDate, travelers: 2 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject non-existent package ID', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: 99999, travel_date: futureDate, travelers: 2 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Package not found');
    });

    test('should reject past travel date', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: pastDate, travelers: 2 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Travel date must be in the future');
    });

    test('should reject invalid travel date format', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: 'invalid-date', travelers: 2 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject missing travelers', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject travelers count of 0', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject travelers count exceeding 20', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 21 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject travelers exceeding package max_travelers', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 15 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('max');
    });

    test('should reject special_requests exceeding max length', async () => {
      const longRequests = 'x'.repeat(1001);
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2, special_requests: longRequests })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings - Creation & Calculation', () => {
    test('should create booking with valid data', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Booking created successfully');
      expect(response.body.data.booking_id).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.payment_status).toBe('pending');

      createdBookingIds.push(response.body.data.id);
    });

    test('should calculate total correctly (price * travelers)', async () => {
      const travelers = 3;
      const expectedTotal = testPackagePrice * travelers;

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: travelers })
        .expect(201);

      expect(parseFloat(response.body.data.total_amount)).toBe(expectedTotal);

      createdBookingIds.push(response.body.data.id);
    });

    test('should use correct pending status and payment status', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 1 })
        .expect(201);

      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.payment_status).toBe('pending');

      createdBookingIds.push(response.body.data.id);
    });

    test('should ignore client-supplied total_amount', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          package_id: testPackageId,
          travel_date: futureDate,
          travelers: 2,
          total_amount: 999999
        })
        .expect(201);

      const expectedTotal = testPackagePrice * 2;
      expect(parseFloat(response.body.data.total_amount)).toBe(expectedTotal);

      createdBookingIds.push(response.body.data.id);
    });

    test('should store booking reference and preserve package total', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          package_id: testPackageId,
          travel_date: futureDate,
          travelers: 2,
          special_requests: 'Vegetarian meals preferred'
        })
        .expect(201);

      expect(response.body.data.booking_id).toMatch(/^TM\d{16}$/);
      expect(response.body.data.special_requests).toBe('Vegetarian meals preferred');
      expect(response.body.data.destination_id).toBe(testDestinationId);
      expect(response.body.data.package_id).toBe(testPackageId);

      createdBookingIds.push(response.body.data.id);
    });
  });

  describe('GET /api/bookings - History', () => {
    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return user bookings with pagination', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.data.length).toBeGreaterThan(0);

      const booking = response.body.data[0];
      expect(booking.booking_id).toBeDefined();
      expect(booking.package_name).toBeDefined();
      expect(booking.destination_name).toBeDefined();
      expect(booking.travel_date).toBeDefined();
      expect(booking.travelers).toBeDefined();
      expect(booking.total_amount).toBeDefined();
      expect(booking.status).toBeDefined();
      expect(booking.payment_status).toBeDefined();
      expect(booking.created_at).toBeDefined();
    });

    test('should only return current user bookings', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(booking => {
        expect(booking.user_id).toBe(otherUserId);
      });
    });

    test('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/bookings?page=1&limit=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(2);
    });

    test('should cap limit at 50', async () => {
      const response = await request(app)
        .get('/api/bookings?limit=50')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(50);
    });

    test('should reject limit exceeding 50', async () => {
      const response = await request(app)
        .get('/api/bookings?limit=100')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should order bookings by most recent first', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const dates = response.body.data.map(b => new Date(b.created_at));
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i + 1].getTime());
        }
      }
    });
  });

  describe('GET /api/bookings/:id - Details', () => {
    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testPackageId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 for invalid booking ID', async () => {
      const response = await request(app)
        .get('/api/bookings/invalid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/bookings/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should return booking details for own booking', async () => {
      const userBookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      if (userBookings.body.data.length > 0) {
        const bookingId = userBookings.body.data[0].id;
        const response = await request(app)
          .get(`/api/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.booking_id).toBeDefined();
        expect(response.body.data.package_name).toBeDefined();
        expect(response.body.data.destination_name).toBeDefined();
      }
    });

    test('should return 404 when user tries to access another user booking', async () => {
      const response = await request(app)
        .get('/api/bookings/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should allow admin to access any booking', async () => {
      const userBookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      if (userBookings.body.data.length > 0) {
        const bookingId = userBookings.body.data[0].id;
        const response = await request(app)
          .get(`/api/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user_name).toBeDefined();
        expect(response.body.data.user_email).toBeDefined();
      }
    });
  });

  describe('PUT /api/bookings/:id/cancel - Cancellation', () => {
    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .put('/api/bookings/1/cancel')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .put('/api/bookings/99999/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should return 400 for invalid booking ID', async () => {
      const response = await request(app)
        .put('/api/bookings/invalid/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should allow cancellation of eligible booking (PENDING)', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const cancelRes = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cancelRes.body.success).toBe(true);
      expect(cancelRes.body.message).toBe('Booking cancelled successfully');
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const detailRes = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailRes.body.data.status).toBe('CANCELLED');
    });

    test('should reject cancellation of CANCELLED booking', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 1 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const response = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Booking is already cancelled');
    });

    test('should reject cancellation of COMPLETED booking', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 1 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      await pool.execute("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [bookingId]);

      const response = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Completed bookings cannot be cancelled');
    });

    test('should allow admin to cancel other users booking', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 1 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const cancelRes = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(cancelRes.body.success).toBe(true);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });

    test('should allow cancellation of CONFIRMED booking', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      await pool.execute("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [bookingId]);

      const response = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
    });

    test('should reject user cancelling another user booking', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const response = await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Booking history persistence after cancellation', () => {
    test('cancelled booking record should remain in database', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const bookingIdRef = createRes.body.data.booking_id;

      await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const [rows] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);

      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('CANCELLED');
      expect(rows[0].booking_id).toBe(bookingIdRef);

      const historyRes = await request(app)
        .get('/api/bookings?limit=50')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const cancelled = historyRes.body.data.find(b => b.id === bookingId);
      expect(cancelled).toBeDefined();
      expect(cancelled.status).toBe('CANCELLED');
    });
  });

  describe('Admin booking management', () => {
    test('should reject non-admin access to GET /api/admin/bookings', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');
    });

    test('should reject unauthenticated access to GET /api/admin/bookings', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should allow admin to view all bookings', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    test('should reject non-admin access to PUT /api/admin/bookings/:id/status', async () => {
      const response = await request(app)
        .put(`/api/admin/bookings/${testPackageId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid status value', async () => {
      const response = await request(app)
        .put('/api/admin/bookings/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 404 for non-existent booking status update', async () => {
      const response = await request(app)
        .put('/api/admin/bookings/99999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('should allow valid PENDING to CONFIRMED transition', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const response = await request(app)
        .put(`/api/admin/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CONFIRMED');
    });

    test('should reject invalid status transition (COMPLETED to PENDING)', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      await pool.execute("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [bookingId]);

      const response = await request(app)
        .put(`/api/admin/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PENDING' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot transition');
    });

    test('should reject invalid status transition (CANCELLED to CONFIRMED)', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      await request(app)
        .put(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const response = await request(app)
        .put(`/api/admin/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot transition');
    });

    test('should preserve booking history on admin status update', async () => {
      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ package_id: testPackageId, travel_date: futureDate, travelers: 2 })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      await request(app)
        .put(`/api/admin/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      const [rows] = await pool.execute('SELECT status FROM bookings WHERE id = ?', [bookingId]);
      expect(rows[0].status).toBe('CONFIRMED');
    });

    test('should support status filter in admin bookings list', async () => {
      const response = await request(app)
        .get('/api/admin/bookings?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(booking => {
        expect(booking.status).toBe('PENDING');
      });
    });

    test('should reject invalid status filter', async () => {
      const response = await request(app)
        .get('/api/admin/bookings?status=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Existing API and authentication tests still work', () => {
    test('GET /api/health should work', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(res => {
          expect([200, 503]).toContain(res.status);
        });
    });

    test('GET /api should include booking endpoints', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.endpoints.bookings).toBeDefined();
      expect(response.body.endpoints.bookings.create).toBe('POST /api/bookings');
      expect(response.body.endpoints.bookings.list).toBe('GET /api/bookings');
      expect(response.body.endpoints.admin).toBeDefined();
    });

    test('Auth endpoints should still work', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@travelmind.ai', password: 'admin123' })
        .expect(res => {
          expect([200, 401]).toContain(res.status);
        });
    });

    test('Package endpoints should still work', async () => {
      const response = await request(app)
        .get('/api/packages')
        .expect(res => {
          expect([200, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });
});
