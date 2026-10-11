const { pool } = require('../config/database');

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
const CANCELABLE_STATUSES = ['PENDING', 'CONFIRMED'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SPECIAL_REQUESTS_MAX_LENGTH = 1000;

function safeJsonParse(field, fallback) {
  if (field === null || field === undefined) return fallback;
  if (typeof field === 'string') {
    try { return JSON.parse(field); } catch (e) { return fallback; }
  }
  if (typeof field === 'object') return field;
  return fallback;
}

function generateBookingId() {
  return 'TM' + Date.now() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

const createBooking = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    const { package_id, travel_date, travelers, special_requests } = req.body;

    const packageId = parseInt(package_id);
    if (isNaN(packageId) || packageId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    if (!travel_date || !DATE_REGEX.test(travel_date)) {
      return res.status(400).json({
        success: false,
        message: 'Valid travel date is required (YYYY-MM-DD)'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    if (travel_date < today) {
      return res.status(400).json({
        success: false,
        message: 'Travel date must be in the future'
      });
    }

    const travelersCount = parseInt(travelers);
    if (isNaN(travelersCount) || travelersCount < 1 || travelersCount > 20) {
      return res.status(400).json({
        success: false,
        message: 'Travelers must be an integer between 1 and 20'
      });
    }

    if (special_requests !== undefined && special_requests !== null) {
      const requestsStr = String(special_requests);
      if (requestsStr.trim().length > SPECIAL_REQUESTS_MAX_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Special requests must not exceed ${SPECIAL_REQUESTS_MAX_LENGTH} characters`
        });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [packages] = await connection.execute(
      `SELECT id, destination_id, name, price_per_person, max_travelers, is_active
       FROM travel_packages
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [packageId]
    );

    if (packages.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const pkg = packages[0];

    if (travelersCount > pkg.max_travelers) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Travelers cannot exceed package maximum of ${pkg.max_travelers}`
      });
    }

    const totalPrice = parseFloat(pkg.price_per_person) * travelersCount;

    let bookingId;
    for (let attempt = 0; attempt < 5; attempt++) {
      bookingId = generateBookingId();
      const [existing] = await connection.execute(
        'SELECT 1 FROM bookings WHERE booking_id = ?',
        [bookingId]
      );
      if (existing.length === 0) break;
    }

    const [result] = await connection.execute(
      `INSERT INTO bookings (
        booking_id, user_id, package_id, destination_id,
        travel_date, travelers, total_amount, status, payment_status, special_requests
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'pending', ?)`,
      [
        bookingId,
        userId,
        packageId,
        pkg.destination_id,
        travel_date,
        travelersCount,
        totalPrice,
        special_requests ? String(special_requests).trim() : null
      ]
    );

    const [created] = await connection.execute(
      `SELECT b.*, tp.name as package_name, tp.duration_days, tp.price_per_person,
              d.name as destination_name, d.location as destination_location
       FROM bookings b
       JOIN travel_packages tp ON b.package_id = tp.id
       JOIN destinations d ON b.destination_id = d.id
       WHERE b.id = ?`,
      [result.insertId]
    );

    await connection.commit();

    const booking = created[0];

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        id: booking.id,
        booking_id: booking.booking_id,
        user_id: booking.user_id,
        package_id: booking.package_id,
        destination_id: booking.destination_id,
        travel_date: booking.travel_date,
        travelers: booking.travelers,
        total_amount: booking.total_amount,
        status: booking.status,
        payment_status: booking.payment_status,
        special_requests: booking.special_requests,
        package_name: booking.package_name,
        package_duration_days: booking.duration_days,
        destination_name: booking.destination_name,
        destination_location: booking.destination_location,
        created_at: booking.created_at,
        updated_at: booking.updated_at
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Create booking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const getBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      WHERE b.user_id = ?
    `;
    const [countResult] = await pool.execute(countQuery, [userId]);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const selectQuery = `
      SELECT b.id, b.booking_id, b.travel_date, b.travelers, b.total_amount,
             b.status, b.payment_status, b.created_at, b.updated_at,
             tp.id as package_id, tp.name as package_name, tp.duration_days,
             d.id as destination_id, d.name as destination_name, d.location as destination_location,
             d.category as destination_category, d.image_url as destination_image
      FROM bookings b
      JOIN travel_packages tp ON b.package_id = tp.id
      JOIN destinations d ON b.destination_id = d.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [bookings] = await pool.execute(selectQuery, [userId, limit, offset]);

    return res.json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings'
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const bookingId = parseInt(req.params.id);

    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    let query;
    let params;

    if (role === 'admin') {
      query = `
        SELECT b.*, tp.name as package_name, tp.duration_days, tp.price_per_person,
               tp.inclusions, tp.exclusions, tp.image_url as package_image_url,
               d.name as destination_name, d.location as destination_location,
               d.category as destination_category, d.image_url as destination_image,
               u.name as user_name, u.email as user_email
        FROM bookings b
        JOIN travel_packages tp ON b.package_id = tp.id
        JOIN destinations d ON b.destination_id = d.id
        JOIN users u ON b.user_id = u.id
        WHERE b.id = ?
      `;
      params = [bookingId];
    } else {
      query = `
        SELECT b.*, tp.name as package_name, tp.duration_days, tp.price_per_person,
               tp.inclusions, tp.exclusions, tp.image_url as package_image_url,
               d.name as destination_name, d.location as destination_location,
               d.category as destination_category, d.image_url as destination_image
        FROM bookings b
        JOIN travel_packages tp ON b.package_id = tp.id
        JOIN destinations d ON b.destination_id = d.id
        WHERE b.id = ? AND b.user_id = ?
      `;
      params = [bookingId, userId];
    }

    const [bookings] = await pool.execute(query, params);

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    if (role !== 'admin' && booking.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    return res.json({
      success: true,
      message: 'Booking retrieved successfully',
      data: {
        id: booking.id,
        booking_id: booking.booking_id,
        user_id: booking.user_id,
        package_id: booking.package_id,
        destination_id: booking.destination_id,
        travel_date: booking.travel_date,
        travelers: booking.travelers,
        total_amount: booking.total_amount,
        status: booking.status,
        payment_status: booking.payment_status,
        special_requests: booking.special_requests,
        package_name: booking.package_name,
        package_duration_days: booking.duration_days,
        package_price_per_person: booking.price_per_person,
        package_inclusions: safeJsonParse(booking.inclusions, []),
        package_exclusions: safeJsonParse(booking.exclusions, []),
        package_image_url: booking.package_image_url,
        destination_name: booking.destination_name,
        destination_location: booking.destination_location,
        destination_category: booking.destination_category,
        destination_image: booking.destination_image,
        user_name: booking.user_name,
        user_email: booking.user_email,
        created_at: booking.created_at,
        updated_at: booking.updated_at
      }
    });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking'
    });
  }
};

const cancelBooking = async (req, res) => {
  let connection;
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const bookingId = parseInt(req.params.id);

    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let bookings;
    if (role === 'admin') {
      [bookings] = await connection.execute(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [bookingId]
      );
    } else {
      [bookings] = await connection.execute(
        'SELECT * FROM bookings WHERE id = ? AND user_id = ? FOR UPDATE',
        [bookingId, userId]
      );
    }

    if (bookings.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    if (!CANCELABLE_STATUSES.includes(booking.status)) {
      let message = 'Booking cannot be cancelled';
      if (booking.status === 'CANCELLED') {
        message = 'Booking is already cancelled';
      } else if (booking.status === 'COMPLETED') {
        message = 'Completed bookings cannot be cancelled';
      }
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message
      });
    }

    await connection.execute(
      'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['CANCELLED', booking.id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        id: booking.id,
        booking_id: booking.booking_id,
        status: 'CANCELLED'
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Cancel booking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  BOOKING_STATUSES
};
