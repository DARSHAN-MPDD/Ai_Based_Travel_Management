const express = require('express');
const { body, query, param } = require('express-validator');
const packageController = require('../controllers/packageController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const packageValidation = [
  body('destination_id')
    .isInt({ min: 1 })
    .withMessage('Valid destination ID is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Package name is required')
    .isLength({ max: 150 })
    .withMessage('Name must not exceed 150 characters'),
  body('description')
    .optional()
    .trim(),
  body('duration_days')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('price_per_person')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  body('inclusions')
    .optional()
    .isArray()
    .withMessage('Inclusions must be an array'),
  body('exclusions')
    .optional()
    .isArray()
    .withMessage('Exclusions must be an array'),
  body('image_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  body('max_travelers')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max travelers must be a positive integer'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
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
  query('destinationId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),
  query('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  query('sort')
    .optional()
    .isIn(['price_asc', 'price_desc', 'name', 'duration'])
    .withMessage('Invalid sort option')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid package ID')
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

router.get('/', queryValidation, validate, packageController.getPackages);
router.get('/:id', idValidation, validate, packageController.getPackageById);

router.post('/', authenticateToken, authorizeRoles('admin'), packageValidation, validate, packageController.createPackage);
router.put('/:id', authenticateToken, authorizeRoles('admin'), [...idValidation, ...packageValidation], validate, packageController.updatePackage);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), idValidation, validate, packageController.deletePackage);

module.exports = router;