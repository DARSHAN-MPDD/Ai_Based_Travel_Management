const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  if (!config.jwt.secret || config.jwt.secret === 'travelmind_ai_secret_key_change_in_production') {
    console.error('JWT secret not properly configured');
    return res.status(500).json({
      success: false,
      message: 'Authentication configuration error'
    });
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token verification failed'
      });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    next();
  });
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  if (!config.jwt.secret || config.jwt.secret === 'travelmind_ai_secret_key_change_in_production') {
    return next();
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (!err) {
      req.user = {
        id: decoded.id,
        role: decoded.role
      };
    }
    next();
  });
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth
};