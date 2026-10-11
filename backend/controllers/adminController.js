const { pool } = require('../config/database');
const { BOOKING_STATUSES } = require('../controllers/bookingController');

const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'COMPLETED'],
  CANCELLED: [],
  COMPLETED: []
};

const getAllBookings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let whereClause = '';
    const params = [];

    if (status) {
      const normalizedStatus = status.toUpperCase();
      if (!BOOKING_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter. Valid values: ${BOOKING_STATUSES.join(', ')}`
        });
      }
      whereClause = 'WHERE b.status = ?';
      params.push(normalizedStatus);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings b
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const selectQuery = `
      SELECT b.id, b.booking_id, b.travel_date, b.travelers, b.total_amount,
             b.status, b.payment_status, b.created_at,
             u.id as user_id, u.name as user_name, u.email as user_email,
             tp.id as package_id, tp.name as package_name,
             d.id as destination_id, d.name as destination_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN travel_packages tp ON b.package_id = tp.id
      JOIN destinations d ON b.destination_id = d.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [bookings] = await pool.execute(selectQuery, [...params, limit, offset]);

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
    console.error('Admin get all bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings'
    });
  }
};

const getAllReviews = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const { rating } = req.query;

    let whereClause = '';
    const params = [];

    if (rating !== undefined && rating !== null && rating !== '') {
      const numericRating = parseInt(rating);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Invalid rating filter. Must be an integer between 1 and 5'
        });
      }
      whereClause = 'WHERE r.rating = ?';
      params.push(numericRating);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM reviews r
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const selectQuery = `
      SELECT r.id, r.destination_id, r.user_id, r.rating, r.title, r.comment,
             r.is_verified, r.created_at, r.updated_at,
             u.name as user_name,
             d.name as destination_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN destinations d ON r.destination_id = d.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [reviews] = await pool.execute(selectQuery, [...params, limit, offset]);

    return res.json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Admin get all reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews'
    });
  }
};

const deleteReview = async (req, res) => {
  let connection;
  try {
    const reviewId = parseInt(req.params.id);

    if (isNaN(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [existing] = await connection.execute(
        'SELECT * FROM reviews WHERE id = ? FOR UPDATE',
        [reviewId]
      );

      if (existing.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      await connection.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);

      await connection.commit();

      return res.json({
        success: true,
        message: 'Review deleted successfully',
        data: { id: reviewId }
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Admin delete review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
};

const updateBookingStatus = async (req, res) => {
  let connection;
  try {
    const bookingId = parseInt(req.params.id);

    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const normalizedStatus = status.toUpperCase();
    if (!BOOKING_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid values: ${BOOKING_STATUSES.join(', ')}`
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [bookings] = await connection.execute(
      'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
      [bookingId]
    );

    if (bookings.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];
    const currentStatus = booking.status;
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(normalizedStatus)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `Cannot transition booking from ${currentStatus} to ${normalizedStatus}`
      });
    }

    await connection.execute(
      'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [normalizedStatus, booking.id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: {
        id: booking.id,
        booking_id: booking.booking_id,
        status: normalizedStatus
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Admin update booking status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update booking status'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getAllBookings,
  updateBookingStatus,
  getAllReviews,
  deleteReview
};
