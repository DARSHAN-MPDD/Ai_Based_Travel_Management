const express = require('express');
const { body, query, param } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

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

const destinationIdValidation = [
  param('destinationId')
    .isInt({ min: 1 })
    .withMessage('Invalid destination ID')
];

const reviewIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid review ID')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Limit must be a positive integer')
];

const reviewValidation = [
  body('destination_id')
    .notEmpty()
    .withMessage('Destination ID is required')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  body('comment')
    .notEmpty()
    .withMessage('Comment is required')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters')
];

const updateReviewValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid review ID'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  body('comment')
    .notEmpty()
    .withMessage('Comment is required')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters')
];

router.post('/', authenticateToken, reviewValidation, validate, reviewController.submitReview);
router.get('/:destinationId/summary', destinationIdValidation, validate, reviewController.getReviewSummary);
router.get('/:destinationId', destinationIdValidation, paginationValidation, validate, reviewController.getReviews);
router.put('/:id', authenticateToken, updateReviewValidation, validate, reviewController.updateReview);
router.delete('/:id', authenticateToken, reviewIdValidation, validate, reviewController.deleteReview);

module.exports = router;
