const { pool } = require('../config/database');

const VALID_TRAVEL_TYPES = ['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury', 'historical', 'religious', 'hill_stations'];
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

const PREFERRED_TRAVEL_TYPE_OPTIONS = ['Adventure', 'Nature', 'Beach', 'Historical Places', 'Cultural Tourism', 'Religious Tourism', 'Wildlife', 'Hill Stations'];
const PREFERRED_DESTINATION_OPTIONS = ['Kerala', 'Karnataka', 'Tamil Nadu', 'Goa', 'Rajasthan', 'Himachal Pradesh', 'Other'];
const BUDGET_PREFERENCE_OPTIONS = ['Budget (Below ₹5,000)', 'Moderate (₹5,000–₹15,000)', 'Premium (₹15,000–₹30,000)', 'Luxury (Above ₹30,000)'];
const ACCOMMODATION_OPTIONS = ['Budget Hotels', 'Standard Hotels', 'Luxury Hotels', 'Resorts', 'Homestays'];
const TRAVEL_STYLE_OPTIONS = ['Solo', 'Family', 'Friends', 'Couple', 'Group'];
const PREFERRED_ACTIVITY_OPTIONS = ['Trekking', 'Photography', 'Sightseeing', 'Shopping', 'Food Exploration', 'Camping', 'Boating', 'Wildlife Safari'];
const TRAVEL_PACE_OPTIONS = ['Relaxed', 'Balanced', 'Fast-paced'];
const DIETARY_OPTIONS = ['Vegetarian', 'Non-Vegetarian', 'No Preference'];

const BUDGET_RANGES = {
  'Budget (Below ₹5,000)': { min: 0, max: 5000 },
  'Moderate (₹5,000–₹15,000)': { min: 5000, max: 15000 },
  'Premium (₹15,000–₹30,000)': { min: 15000, max: 30000 },
  'Luxury (Above ₹30,000)': { min: 30000, max: 100000 }
};

function parseJsonArray(val) {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
    } catch (_) {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeEnumInput(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}
function matchOption(val, options) {
  if (val == null || val === '') return val;
  const n = normalizeEnumInput(val);
  const found = options.find(o => normalizeEnumInput(o) === n);
  return found || val;
}

function validateEnum(val, options, name, errors) {
  if (val !== undefined && val !== null && val !== '') {
    if (typeof val !== 'string') { errors.push(`${name} must be a text value`); return; }
    const matched = matchOption(val, options);
    if (!options.includes(matched) && !options.some(o => normalizeEnumInput(o) === normalizeEnumInput(val))) {
      errors.push(`${name} must be one of: ${options.join(', ')}`);
    }
  }
}

function validateArray(val, options, name, errors, allowOther) {
  if (val === undefined || val === null) return;
  if (!Array.isArray(val)) {
    errors.push(`${name} must be an array`);
    return;
  }
  val.forEach(item => {
    if (typeof item !== 'string') { errors.push(`${name} contains invalid value`); return; }
    if (allowOther && item === 'Other') return;
    if (!options.includes(item)) errors.push(`${name} contains unsupported value: ${item}`);
  });
}

const validatePreferences = (body) => {
  const errors = [];

  if (body.budget_min !== undefined && body.budget_min !== null && body.budget_min !== '') {
    const val = parseFloat(body.budget_min);
    if (isNaN(val) || val < 0) errors.push('budget_min must be a positive number');
  }

  if (body.budget_max !== undefined && body.budget_max !== null && body.budget_max !== '') {
    const val = parseFloat(body.budget_max);
    if (isNaN(val) || val < 0) errors.push('budget_max must be a positive number');
  }

  if (body.budget_min !== undefined && body.budget_max !== undefined && body.budget_min !== null && body.budget_max !== null && body.budget_min !== '' && body.budget_max !== '') {
    if (parseFloat(body.budget_min) > parseFloat(body.budget_max)) errors.push('budget_min cannot exceed budget_max');
  }

  if (body.preferred_duration !== undefined && body.preferred_duration !== null && body.preferred_duration !== '') {
    const val = parseInt(body.preferred_duration);
    if (isNaN(val) || val < 1) errors.push('preferred_duration must be a positive integer');
  }

  if (body.travel_type !== undefined && body.travel_type !== null && body.travel_type !== '') {
    if (!VALID_TRAVEL_TYPES.includes(String(body.travel_type).toLowerCase())) {
      errors.push(`travel_type must be one of: ${VALID_TRAVEL_TYPES.join(', ')}`);
    }
  }

  SCORE_FIELDS.forEach(field => {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      const val = parseInt(body[field]);
      if (isNaN(val) || val < 0 || val > 100) errors.push(`${field} must be an integer between 0 and 100`);
    }
  });

  validateArray(body.preferred_travel_types, PREFERRED_TRAVEL_TYPE_OPTIONS, 'preferred_travel_types', errors, false);
  validateArray(body.preferred_destinations, PREFERRED_DESTINATION_OPTIONS, 'preferred_destinations', errors, true);
  validateArray(body.preferred_activities, PREFERRED_ACTIVITY_OPTIONS, 'preferred_activities', errors, false);
  validateEnum(body.budget_preference, BUDGET_PREFERENCE_OPTIONS, 'budget_preference', errors);
  validateEnum(body.accommodation_preference, ACCOMMODATION_OPTIONS, 'accommodation_preference', errors);
  validateEnum(body.travel_style, TRAVEL_STYLE_OPTIONS, 'travel_style', errors);
  validateEnum(body.preferred_travel_pace, TRAVEL_PACE_OPTIONS, 'preferred_travel_pace', errors);
  validateEnum(body.dietary_preference, DIETARY_OPTIONS, 'dietary_preference', errors);

  if (body.preferred_trip_duration !== undefined && body.preferred_trip_duration !== null && body.preferred_trip_duration !== '') {
    if (typeof body.preferred_trip_duration !== 'string' || body.preferred_trip_duration.length > 50) errors.push('preferred_trip_duration must be a short text value');
  }
  if (body.additional_requirements !== undefined && body.additional_requirements !== null && body.additional_requirements !== '') {
    if (typeof body.additional_requirements !== 'string' || body.additional_requirements.length > 2000) errors.push('additional_requirements must be 2000 characters or less');
  }

  return errors;
};

function deriveInterestScores(types, activities) {
  const t = new Set((types || []).map(s => String(s).toLowerCase()));
  const a = new Set((activities || []).map(s => String(s).toLowerCase()));
  const has = (...keys) => keys.some(k => t.has(k) || a.has(k));
  const score = (match) => match ? 85 : 20;
  return {
    nature_interest: score(has('nature', 'hill stations', 'hill_stations', 'trekking', 'camping')),
    adventure_interest: score(has('adventure', 'trekking', 'camping', 'wildlife safari', 'wildlife')),
    beach_interest: score(has('beach', 'boating')),
    history_interest: score(has('historical places', 'historical', 'religious tourism', 'sightseeing')),
    culture_interest: score(has('cultural tourism', 'culture', 'religious tourism', 'sightseeing', 'food exploration')),
    food_interest: score(has('food exploration', 'food')),
    photography_interest: score(has('photography')),
    shopping_interest: score(has('shopping', 'sightseeing'))
  };
}

function normalizeForStorage(body) {
  const preferred_travel_types = parseJsonArray(body.preferred_travel_types);
  const preferred_destinations = parseJsonArray(body.preferred_destinations);
  const preferred_activities = parseJsonArray(body.preferred_activities);

  let budget_min = body.budget_min !== undefined && body.budget_min !== null && body.budget_min !== '' ? parseFloat(body.budget_min) : null;
  let budget_max = body.budget_max !== undefined && body.budget_max !== null && body.budget_max !== '' ? parseFloat(body.budget_max) : null;
  const budget_preference = matchOption(body.budget_preference, BUDGET_PREFERENCE_OPTIONS) || null;
  if (budget_preference && BUDGET_RANGES[budget_preference] && (budget_min === null || budget_max === null)) {
    const r = BUDGET_RANGES[budget_preference];
    if (budget_min === null) budget_min = r.min;
    if (budget_max === null) budget_max = r.max;
  }

  let preferred_duration = body.preferred_duration !== undefined && body.preferred_duration !== null && body.preferred_duration !== '' ? parseInt(body.preferred_duration) : null;
  const preferred_trip_duration = body.preferred_trip_duration || null;
  if (preferred_duration === null && preferred_trip_duration) {
    const m = String(preferred_trip_duration).match(/(\d+)/);
    if (m) preferred_duration = parseInt(m[1]);
  }

  const hasExplicitScores = SCORE_FIELDS.some(f => body[f] !== undefined && body[f] !== null && body[f] !== '');
  let scores;
  if (hasExplicitScores) {
    scores = {};
    SCORE_FIELDS.forEach(f => { scores[f] = body[f] !== undefined && body[f] !== null && body[f] !== '' ? parseInt(body[f]) : 0; });
  } else if (preferred_travel_types.length || preferred_activities.length) {
    scores = deriveInterestScores(preferred_travel_types, preferred_activities);
  } else {
    scores = {};
    SCORE_FIELDS.forEach(f => { scores[f] = 0; });
  }

  let travel_type = body.travel_type ? String(body.travel_type).toLowerCase() : null;
  if (!travel_type && preferred_travel_types.length) {
    const map = { 'Nature': 'nature', 'Adventure': 'adventure', 'Beach': 'beach', 'Historical Places': 'heritage', 'Cultural Tourism': 'culture', 'Religious Tourism': 'spiritual', 'Wildlife': 'wildlife', 'Hill Stations': 'nature' };
    travel_type = map[preferred_travel_types[0]] || null;
  }

  return {
    budget_min,
    budget_max,
    preferred_duration,
    travel_type,
    ...scores,
    preferred_travel_types: JSON.stringify(preferred_travel_types),
    preferred_destinations: JSON.stringify(preferred_destinations),
    budget_preference,
    accommodation_preference: matchOption(body.accommodation_preference, ACCOMMODATION_OPTIONS) || null,
    travel_style: matchOption(body.travel_style, TRAVEL_STYLE_OPTIONS) || null,
    preferred_activities: JSON.stringify(preferred_activities),
    preferred_trip_duration,
    preferred_travel_pace: matchOption(body.preferred_travel_pace, TRAVEL_PACE_OPTIONS) || null,
    dietary_preference: matchOption(body.dietary_preference, DIETARY_OPTIONS) || null,
    additional_requirements: body.additional_requirements || null
  };
}

function formatPreferences(row) {
  if (!row) return null;
  return {
    ...row,
    budget_min: row.budget_min != null ? parseFloat(row.budget_min) : null,
    budget_max: row.budget_max != null ? parseFloat(row.budget_max) : null,
    preferred_travel_types: parseJsonArray(row.preferred_travel_types),
    preferred_destinations: parseJsonArray(row.preferred_destinations),
    preferred_activities: parseJsonArray(row.preferred_activities)
  };
}

const getPreferences = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const userId = req.user.id;

    const [preferences] = await pool.execute(
      `SELECT * FROM user_preferences WHERE user_id = ?`,
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
      data: formatPreferences(preferences[0])
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
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const userId = req.user.id;
    const errors = validatePreferences(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const v = normalizeForStorage(req.body);

    await pool.execute(
      `INSERT INTO user_preferences (
        user_id, budget_min, budget_max, preferred_duration, travel_type,
        nature_interest, adventure_interest, beach_interest, history_interest,
        culture_interest, food_interest, photography_interest, shopping_interest,
        preferred_travel_types, preferred_destinations, budget_preference, accommodation_preference,
        travel_style, preferred_activities, preferred_trip_duration, preferred_travel_pace,
        dietary_preference, additional_requirements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        shopping_interest = VALUES(shopping_interest),
        preferred_travel_types = VALUES(preferred_travel_types),
        preferred_destinations = VALUES(preferred_destinations),
        budget_preference = VALUES(budget_preference),
        accommodation_preference = VALUES(accommodation_preference),
        travel_style = VALUES(travel_style),
        preferred_activities = VALUES(preferred_activities),
        preferred_trip_duration = VALUES(preferred_trip_duration),
        preferred_travel_pace = VALUES(preferred_travel_pace),
        dietary_preference = VALUES(dietary_preference),
        additional_requirements = VALUES(additional_requirements)`,
      [
        userId,
        v.budget_min, v.budget_max, v.preferred_duration, v.travel_type,
        v.nature_interest, v.adventure_interest, v.beach_interest, v.history_interest,
        v.culture_interest, v.food_interest, v.photography_interest, v.shopping_interest,
        v.preferred_travel_types, v.preferred_destinations, v.budget_preference, v.accommodation_preference,
        v.travel_style, v.preferred_activities, v.preferred_trip_duration, v.preferred_travel_pace,
        v.dietary_preference, v.additional_requirements
      ]
    );

    const [saved] = await pool.execute('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Preferences saved successfully',
      data: formatPreferences(saved[0])
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
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const userId = req.user.id;
    const errors = validatePreferences(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const [existing] = await pool.execute('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
    if (existing.length === 0) {
      return savePreferences(req, res);
    }

    const merged = { ...formatPreferences(existing[0]), ...req.body };
    const v = normalizeForStorage(merged);

    await pool.execute(
      `UPDATE user_preferences SET
        budget_min = ?, budget_max = ?, preferred_duration = ?, travel_type = ?,
        nature_interest = ?, adventure_interest = ?, beach_interest = ?, history_interest = ?,
        culture_interest = ?, food_interest = ?, photography_interest = ?, shopping_interest = ?,
        preferred_travel_types = ?, preferred_destinations = ?, budget_preference = ?, accommodation_preference = ?,
        travel_style = ?, preferred_activities = ?, preferred_trip_duration = ?, preferred_travel_pace = ?,
        dietary_preference = ?, additional_requirements = ?
       WHERE user_id = ?`,
      [
        v.budget_min, v.budget_max, v.preferred_duration, v.travel_type,
        v.nature_interest, v.adventure_interest, v.beach_interest, v.history_interest,
        v.culture_interest, v.food_interest, v.photography_interest, v.shopping_interest,
        v.preferred_travel_types, v.preferred_destinations, v.budget_preference, v.accommodation_preference,
        v.travel_style, v.preferred_activities, v.preferred_trip_duration, v.preferred_travel_pace,
        v.dietary_preference, v.additional_requirements,
        userId
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: formatPreferences(updated[0])
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
  SCORE_FIELDS,
  PREFERRED_TRAVEL_TYPE_OPTIONS,
  PREFERRED_DESTINATION_OPTIONS,
  BUDGET_PREFERENCE_OPTIONS,
  ACCOMMODATION_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  PREFERRED_ACTIVITY_OPTIONS,
  TRAVEL_PACE_OPTIONS,
  DIETARY_OPTIONS
};
