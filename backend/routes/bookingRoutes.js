const express = require('express');
const { body, query, param } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const createBookingValidation = [
  body('package_id')
    .notEmpty()
    .withMessage('Package ID is required')
    .isInt({ min: 1 })
    .withMessage('Package ID must be a positive integer'),
  body('travel_date')
    .notEmpty()
    .withMessage('Travel date is required')
    .isISO8601()
    .withMessage('Travel date must be a valid date (YYYY-MM-DD)'),
  body('travelers')
    .notEmpty()
    .withMessage('Number of travelers is required')
    .isInt({ min: 1, max: 20 })
    .withMessage('Travelers must be an integer between 1 and 20'),
  body('special_requests')
    .optional()
    .isString()
    .withMessage('Special requests must be a string')
    .isLength({ max: 1000 })
    .withMessage('Special requests must not exceed 1000 characters')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid booking ID')
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

router.post('/', authenticateToken, createBookingValidation, validate, bookingController.createBooking);
router.get('/', authenticateToken, paginationValidation, validate, bookingController.getBookings);
router.get('/:id', authenticateToken, idValidation, validate, bookingController.getBookingById);
router.put('/:id/cancel', authenticateToken, idValidation, validate, bookingController.cancelBooking);

module.exports = router;
