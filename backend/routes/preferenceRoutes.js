const express = require('express');
const { body } = require('express-validator');
const preferenceController = require('../controllers/preferenceController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const preferenceValidation = [
  body('budget_min')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('budget_min must be a positive number'),
  body('budget_max')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('budget_max must be a positive number'),
  body('preferred_duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('preferred_duration must be a positive integer'),
  body('travel_type')
    .optional()
    .isIn(preferenceController.VALID_TRAVEL_TYPES)
    .withMessage(`travel_type must be one of: ${preferenceController.VALID_TRAVEL_TYPES.join(', ')}`),
  body('nature_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('nature_interest must be between 0 and 100'),
  body('adventure_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('adventure_interest must be between 0 and 100'),
  body('beach_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('beach_interest must be between 0 and 100'),
  body('history_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('history_interest must be between 0 and 100'),
  body('culture_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('culture_interest must be between 0 and 100'),
  body('food_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('food_interest must be between 0 and 100'),
  body('photography_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('photography_interest must be between 0 and 100'),
  body('shopping_interest')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('shopping_interest must be between 0 and 100')
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

router.get('/', authenticateToken, preferenceController.getPreferences);
router.post('/', authenticateToken, preferenceValidation, validate, preferenceController.savePreferences);
router.put('/', authenticateToken, preferenceValidation, validate, preferenceController.updatePreferences);

module.exports = router;