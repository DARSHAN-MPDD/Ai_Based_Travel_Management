const express = require('express');
const { body, query, param } = require('express-validator');
const destinationController = require('../controllers/destinationController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const destinationValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Destination name is required')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('description')
    .optional()
    .trim(),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Location must not exceed 150 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters'),
  body('estimated_budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated budget must be a positive number'),
  body('recommended_duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Recommended duration must be a positive integer'),
  body('best_time')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Best time must not exceed 100 characters'),
  body('activities')
    .optional()
    .isArray()
    .withMessage('Activities must be an array'),
  body('image_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  body('nature_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Nature score must be between 0 and 100'),
  body('adventure_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Adventure score must be between 0 and 100'),
  body('beach_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Beach score must be between 0 and 100'),
  body('history_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('History score must be between 0 and 100'),
  body('culture_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Culture score must be between 0 and 100'),
  body('food_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Food score must be between 0 and 100'),
  body('photography_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Photography score must be between 0 and 100'),
  body('shopping_score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Shopping score must be between 0 and 100')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must not exceed 100 characters'),
  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters'),
  query('minBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum budget must be a positive number'),
  query('maxBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum budget must be a positive number'),
  query('sort')
    .optional()
    .isIn(['name', 'budget_asc', 'budget_desc'])
    .withMessage('Invalid sort option')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid destination ID')
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

router.get('/', queryValidation, validate, destinationController.getDestinations);
router.get('/:id', idValidation, validate, destinationController.getDestinationById);
router.get('/:id/packages', idValidation, validate, destinationController.getDestinationPackages);

router.post('/', authenticateToken, authorizeRoles('admin'), destinationValidation, validate, destinationController.createDestination);
router.put('/:id', authenticateToken, authorizeRoles('admin'), [...idValidation, ...destinationValidation], validate, destinationController.updateDestination);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), idValidation, validate, destinationController.deleteDestination);

module.exports = router;