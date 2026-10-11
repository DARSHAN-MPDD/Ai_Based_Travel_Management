const express = require('express');
const { body, query, param } = require('express-validator');
const itineraryController = require('../controllers/itineraryController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const generateValidation = [
  body('destination_id')
    .notEmpty()
    .withMessage('Destination ID is required')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .isInt({ min: 1, max: 30 })
    .withMessage('Duration must be between 1 and 30 days'),
  body('budget')
    .notEmpty()
    .withMessage('Budget is required')
    .isFloat({ min: 1, max: 10000000 })
    .withMessage('Budget must be a positive number up to ₹1,00,00,000'),
  body('travelers')
    .notEmpty()
    .withMessage('Number of travelers is required')
    .isInt({ min: 1, max: 20 })
    .withMessage('Number of travelers must be between 1 and 20'),
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),
  body('interests.*')
    .optional()
    .isIn(['nature', 'adventure', 'beach', 'history', 'culture', 'food', 'photography', 'shopping'])
    .withMessage('Invalid interest value'),
  body('travel_type')
    .optional()
    .isIn(['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury'])
    .withMessage('Invalid travel type'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid itinerary ID')
];

const listValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20')
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

router.post('/', authenticateToken, generateValidation, validate, itineraryController.generateItinerary);
router.get('/', authenticateToken, listValidation, validate, itineraryController.getUserItineraries);
router.get('/:id', authenticateToken, idValidation, validate, itineraryController.getItineraryById);

module.exports = router;