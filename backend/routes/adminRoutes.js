const express = require('express');
const { body, query, param } = require('express-validator');
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const bookingIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid booking ID')
];

const reviewIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid review ID')
];

const reviewPaginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating filter must be an integer between 1 and 5')
];

const statusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
    .withMessage('Invalid status value')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional()
    .isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
    .withMessage('Invalid status filter')
];

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

router.get('/bookings', authenticateToken, authorizeRoles('admin'), paginationValidation, validate, adminController.getAllBookings);
router.put('/bookings/:id/status', authenticateToken, authorizeRoles('admin'), [...bookingIdValidation, ...statusValidation], validate, adminController.updateBookingStatus);

router.get('/reviews', authenticateToken, authorizeRoles('admin'), reviewPaginationValidation, validate, adminController.getAllReviews);
router.delete('/reviews/:id', authenticateToken, authorizeRoles('admin'), reviewIdValidation, validate, adminController.deleteReview);

module.exports = router;
