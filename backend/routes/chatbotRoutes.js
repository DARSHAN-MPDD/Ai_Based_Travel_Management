const express = require('express');
const { body, query } = require('express-validator');
const chatbotController = require('../controllers/chatbotController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');

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

const messageValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('session_id')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Session ID must be between 1 and 100 characters')
];

const sessionIdValidation = [
  query('session_id')
    .notEmpty()
    .withMessage('Session ID is required')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Session ID must be between 1 and 100 characters')
];

router.post('/message', optionalAuth, messageValidation, validate, chatbotController.sendMessage);
router.get('/session', optionalAuth, sessionIdValidation, validate, chatbotController.getSession);
router.delete('/session', optionalAuth, sessionIdValidation, validate, chatbotController.clearSession);

module.exports = router;
