const { pool } = require('../config/database');

const VALID_TRAVEL_TYPES = ['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury'];
const SCORE_FIELDS = [
  'nature_interest',
  'adventure_interest',
  'beach_interest',
  'history_interest',
  'culture_interest',
  'food_interest',
  'photography_interest',
  'shopping_interest'
];

const validatePreferences = (body) => {
  const errors = [];

  if (body.budget_min !== undefined && body.budget_min !== null) {
    const val = parseFloat(body.budget_min);
    if (isNaN(val) || val < 0) {
      errors.push('budget_min must be a positive number');
    }
  }

  if (body.budget_max !== undefined && body.budget_max !== null) {
    const val = parseFloat(body.budget_max);
    if (isNaN(val) || val < 0) {
      errors.push('budget_max must be a positive number');
    }
  }

  if (body.budget_min !== undefined && body.budget_max !== undefined && body.budget_min !== null && body.budget_max !== null) {
    if (parseFloat(body.budget_min) > parseFloat(body.budget_max)) {
      errors.push('budget_min cannot exceed budget_max');
    }
  }

  if (body.preferred_duration !== undefined && body.preferred_duration !== null) {
    const val = parseInt(body.preferred_duration);
    if (isNaN(val) || val < 1) {
      errors.push('preferred_duration must be a positive integer');
    }
  }

  if (body.travel_type !== undefined && body.travel_type !== null) {
    if (!VALID_TRAVEL_TYPES.includes(body.travel_type.toLowerCase())) {
      errors.push(`travel_type must be one of: ${VALID_TRAVEL_TYPES.join(', ')}`);
    }
  }

  SCORE_FIELDS.forEach(field => {
    if (body[field] !== undefined && body[field] !== null) {
      const val = parseInt(body[field]);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push(`${field} must be an integer between 0 and 100`);
      }
    }
  });

  return errors;
};

const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const [preferences] = await pool.execute(
      `SELECT user_id, budget_min, budget_max, preferred_duration, travel_type,
              nature_interest, adventure_interest, beach_interest, history_interest,
              culture_interest, food_interest, photography_interest, shopping_interest,
              created_at, updated_at
       FROM user_preferences WHERE user_id = ?`,
      [userId]
    );

    if (preferences.length === 0) {
      return res.json({
        success: true,
        message: 'No preferences saved yet',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Preferences retrieved successfully',
      data: preferences[0]
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve preferences'
    });
  }
};

const savePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const errors = validatePreferences(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const {
      budget_min, budget_max, preferred_duration, travel_type,
      nature_interest, adventure_interest, beach_interest, history_interest,
      culture_interest, food_interest, photography_interest, shopping_interest
    } = req.body;

    const scoreValues = SCORE_FIELDS.map(field => {
      const val = req.body[field];
      return val !== undefined && val !== null ? parseInt(val) : 0;
    });

    await pool.execute(
      `INSERT INTO user_preferences (
        user_id, budget_min, budget_max, preferred_duration, travel_type,
        nature_interest, adventure_interest, beach_interest, history_interest,
        culture_interest, food_interest, photography_interest, shopping_interest
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        budget_min = VALUES(budget_min),
        budget_max = VALUES(budget_max),
        preferred_duration = VALUES(preferred_duration),
        travel_type = VALUES(travel_type),
        nature_interest = VALUES(nature_interest),
        adventure_interest = VALUES(adventure_interest),
        beach_interest = VALUES(beach_interest),
        history_interest = VALUES(history_interest),
        culture_interest = VALUES(culture_interest),
        food_interest = VALUES(food_interest),
        photography_interest = VALUES(photography_interest),
        shopping_interest = VALUES(shopping_interest)`,
      [
        userId,
        budget_min ? parseFloat(budget_min) : null,
        budget_max ? parseFloat(budget_max) : null,
        preferred_duration ? parseInt(preferred_duration) : null,
        travel_type?.toLowerCase() || null,
        ...scoreValues
      ]
    );

    const [saved] = await pool.execute(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [userId]
    );

    return res.json({
      success: true,
      message: 'Preferences saved successfully',
      data: saved[0]
    });
  } catch (error) {
    console.error('Save preferences error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save preferences'
    });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const errors = validatePreferences(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const [existing] = await pool.execute('SELECT user_id FROM user_preferences WHERE user_id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No preferences found to update. Use POST to create preferences first.'
      });
    }

    const allowedFields = [
      'budget_min', 'budget_max', 'preferred_duration', 'travel_type',
      ...SCORE_FIELDS
    ];

    const updates = [];
    const params = [];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (SCORE_FIELDS.includes(field)) {
          params.push(req.body[field] !== null ? parseInt(req.body[field]) : 0);
        } else if (field === 'budget_min' || field === 'budget_max') {
          params.push(req.body[field] !== null ? parseFloat(req.body[field]) : null);
        } else if (field === 'preferred_duration') {
          params.push(req.body[field] !== null ? parseInt(req.body[field]) : null);
        } else if (field === 'travel_type') {
          params.push(req.body[field]?.toLowerCase() || null);
        } else {
          params.push(req.body[field] || null);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    params.push(userId);
    await pool.execute(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );

    const [updated] = await pool.execute('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
};

module.exports = {
  getPreferences,
  savePreferences,
  updatePreferences,
  VALID_TRAVEL_TYPES,
  SCORE_FIELDS
};