const { pool } = require('../config/database');

const MAX_COMMENT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

const buildReviewResponse = (review) => {
  return {
    id: review.id,
    user_id: review.user_id,
    destination_id: review.destination_id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    is_verified: review.is_verified,
    created_at: review.created_at,
    updated_at: review.updated_at,
    user_name: review.user_name
  };
};

const submitReview = async (req, res) => {
  let connection;
  try {
    const { destination_id, rating, title, comment } = req.body;
    const userId = req.user.id;

    const destinationId = parseInt(destination_id);
    if (isNaN(destinationId) || destinationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`
      });
    }

    let trimmedTitle = null;
    if (title !== undefined && title !== null && title !== '') {
      trimmedTitle = String(title).trim();
      if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Title must not exceed ${MAX_TITLE_LENGTH} characters`
        });
      }
    }

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [destinations] = await connection.execute(
        'SELECT id FROM destinations WHERE id = ?',
        [destinationId]
      );

      if (destinations.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Destination not found'
        });
      }

      const [result] = await connection.execute(
        `INSERT INTO reviews (user_id, destination_id, rating, title, comment, is_verified)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [userId, destinationId, numericRating, trimmedTitle, trimmedComment]
      );

      const [newReview] = await connection.execute(
        `SELECT r.*, u.name as user_name
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.id = ?`,
        [result.insertId]
      );

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: buildReviewResponse(newReview[0])
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
};

const getReviews = async (req, res) => {
  try {
    const destinationId = parseInt(req.params.destinationId);

    if (isNaN(destinationId) || destinationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const [destinations] = await pool.execute(
      'SELECT id FROM destinations WHERE id = ?',
      [destinationId]
    );

    if (destinations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM reviews WHERE destination_id = ?',
      [destinationId]
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    if (total === 0) {
      return res.json({
        success: true,
        message: 'No reviews found',
        data: [],
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    }

    const [reviews] = await pool.execute(
      `SELECT r.id, r.user_id, r.destination_id, r.rating, r.title, r.comment,
              r.is_verified, r.created_at, r.updated_at, u.name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.destination_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [destinationId, limit, offset]
    );

    return res.json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: reviews.map(buildReviewResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews'
    });
  }
};

const getReviewById = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);

    if (isNaN(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const [reviews] = await pool.execute(
      `SELECT r.*, u.name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [reviewId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    return { review: reviews[0], found: true };
  } catch (error) {
    console.error('Get review by ID error:', error);
    return { review: null, found: false, error: true };
  }
};

const updateReview = async (req, res) => {
  let connection;
  try {
    const reviewId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const { rating, title, comment } = req.body;

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    let trimmedTitle = null;
    if (title !== undefined && title !== null && title !== '') {
      trimmedTitle = String(title).trim();
      if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Title must not exceed ${MAX_TITLE_LENGTH} characters`
        });
      }
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`
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

      if (existing[0].user_id !== userId) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'You can only edit your own reviews'
        });
      }

      await connection.execute(
        `UPDATE reviews
         SET rating = ?, title = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [numericRating, trimmedTitle, trimmedComment, reviewId]
      );

      const [updated] = await connection.execute(
        `SELECT r.*, u.name as user_name
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.id = ?`,
        [reviewId]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: 'Review updated successfully',
        data: buildReviewResponse(updated[0])
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
    console.error('Update review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
};

const deleteReview = async (req, res) => {
  let connection;
  try {
    const reviewId = parseInt(req.params.id);
    const userId = req.user.id;
    const userRole = req.user.role;

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

      if (existing[0].user_id !== userId && userRole !== 'admin') {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own reviews'
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
    console.error('Delete review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
};

const getReviewSummary = async (req, res) => {
  try {
    const destinationId = parseInt(req.params.destinationId);

    if (isNaN(destinationId) || destinationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const [destinations] = await pool.execute(
      'SELECT id FROM destinations WHERE id = ?',
      [destinationId]
    );

    if (destinations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const [rows] = await pool.execute(
      `SELECT
         COALESCE(AVG(rating), 0) as average_rating,
         COUNT(*) as total_reviews,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5
       FROM reviews
       WHERE destination_id = ?`,
      [destinationId]
    );

    const avgData = rows[0] || { average_rating: 0, total_reviews: 0, count_1: 0, count_2: 0, count_3: 0, count_4: 0, count_5: 0 };
    const totalReviews = parseInt(avgData.total_reviews) || 0;

    return res.json({
      success: true,
      message: 'Review summary retrieved successfully',
      data: {
        destination_id: destinationId,
        average_rating: totalReviews > 0
          ? Math.round(parseFloat(avgData.average_rating) * 10) / 10
          : 0,
        total_reviews: totalReviews,
        rating_distribution: {
          '1': parseInt(avgData.count_1) || 0,
          '2': parseInt(avgData.count_2) || 0,
          '3': parseInt(avgData.count_3) || 0,
          '4': parseInt(avgData.count_4) || 0,
          '5': parseInt(avgData.count_5) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get review summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve review summary'
    });
  }
};

module.exports = {
  buildReviewResponse,
  getReviewById,
  submitReview,
  getReviews,
  updateReview,
  deleteReview,
  getReviewSummary
};
