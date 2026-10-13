const { pool } = require('../config/database');

const SCORE_FIELDS = [
  'nature_score',
  'adventure_score',
  'beach_score',
  'history_score',
  'culture_score',
  'food_score',
  'photography_score',
  'shopping_score'
];

const validateScores = (body) => {
  const errors = [];
  SCORE_FIELDS.forEach(field => {
    if (body[field] !== undefined) {
      const value = parseInt(body[field]);
      if (isNaN(value) || value < 0 || value > 100) {
        errors.push(`${field} must be an integer between 0 and 100`);
      }
    }
  });
  return errors;
};

const buildDestinationQuery = (query) => {
  const {
    page = 1,
    limit = 12,
    search,
    category,
    minBudget,
    maxBudget,
    sort = 'name'
  } = query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let whereClause = 'WHERE is_active = TRUE';
  const params = [];

  if (search) {
    whereClause += ' AND (name LIKE ? OR location LIKE ? OR description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (category) {
    whereClause += ' AND category = ?';
    params.push(category);
  }

  if (minBudget !== undefined) {
    whereClause += ' AND estimated_budget >= ?';
    params.push(parseFloat(minBudget));
  }

  if (maxBudget !== undefined) {
    whereClause += ' AND estimated_budget <= ?';
    params.push(parseFloat(maxBudget));
  }

  let orderClause = 'ORDER BY name ASC';
  switch (sort) {
    case 'budget_asc':
      orderClause = 'ORDER BY estimated_budget ASC';
      break;
    case 'budget_desc':
      orderClause = 'ORDER BY estimated_budget DESC';
      break;
    case 'name':
      orderClause = 'ORDER BY name ASC';
      break;
    default:
      orderClause = 'ORDER BY name ASC';
  }

  return { whereClause, orderClause, params, limit: limitNum, offset, page: pageNum };
};

const getDestinations = async (req, res) => {
  try {
    const { whereClause, orderClause, params, limit, offset, page } = buildDestinationQuery(req.query);

    const countQuery = `SELECT COUNT(*) as total FROM destinations ${whereClause}`;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const selectQuery = `
      SELECT id, name, description, location, category, estimated_budget,
             recommended_duration, best_time, activities, image_url,
             nature_score, adventure_score, beach_score, history_score,
             culture_score, food_score, photography_score, shopping_score,
             is_active, created_at, updated_at
      FROM destinations
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const selectParams = [...params, limit, offset];
    const [destinations] = await pool.execute(selectQuery, selectParams);

    return res.json({
      success: true,
      message: 'Destinations retrieved successfully',
      data: destinations,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get destinations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve destinations'
    });
  }
};

const getDestinationById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const [destinations] = await pool.execute(
      `SELECT id, name, description, location, category, estimated_budget,
              recommended_duration, best_time, activities, image_url,
              nature_score, adventure_score, beach_score, history_score,
              culture_score, food_score, photography_score, shopping_score,
              is_active, created_at, updated_at
       FROM destinations WHERE id = ?`,
      [id]
    );

    if (destinations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const [packages] = await pool.execute(
      `SELECT id, name, description, duration_days, price_per_person,
              inclusions, exclusions, image_url, max_travelers, is_active
       FROM travel_packages
       WHERE destination_id = ? AND is_active = TRUE
       ORDER BY price_per_person ASC`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Destination retrieved successfully',
      data: {
        ...destinations[0],
        packages
      }
    });
  } catch (error) {
    console.error('Get destination by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve destination'
    });
  }
};

const getDestinationPackages = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const [destinations] = await pool.execute(
      'SELECT id FROM destinations WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (destinations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const [packages] = await pool.execute(
      `SELECT id, name, description, duration_days, price_per_person,
              inclusions, exclusions, image_url, max_travelers, is_active
       FROM travel_packages
       WHERE destination_id = ? AND is_active = TRUE
       ORDER BY price_per_person ASC`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Destination packages retrieved successfully',
      data: packages
    });
  } catch (error) {
    console.error('Get destination packages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve packages'
    });
  }
};

const createDestination = async (req, res) => {
  try {
    const scoreErrors = validateScores(req.body);
    if (scoreErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: scoreErrors
      });
    }

    const {
      name, description, location, category, estimated_budget,
      recommended_duration, best_time, activities, image_url,
      nature_score, adventure_score, beach_score, history_score,
      culture_score, food_score, photography_score, shopping_score
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Destination name is required'
      });
    }

    if (estimated_budget !== undefined && (isNaN(estimated_budget) || estimated_budget < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Estimated budget must be a positive number'
      });
    }

    if (recommended_duration !== undefined && (isNaN(recommended_duration) || recommended_duration <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Recommended duration must be a positive integer'
      });
    }

    const scoreValues = SCORE_FIELDS.map(field => {
      const val = req.body[field];
      return val !== undefined ? parseInt(val) : 0;
    });

    const [result] = await pool.execute(
      `INSERT INTO destinations (
        name, description, location, category, estimated_budget,
        recommended_duration, best_time, activities, image_url,
        nature_score, adventure_score, beach_score, history_score,
        culture_score, food_score, photography_score, shopping_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        description?.trim() || null,
        location?.trim() || null,
        category?.trim() || null,
        estimated_budget ? parseFloat(estimated_budget) : null,
        recommended_duration ? parseInt(recommended_duration) : null,
        best_time?.trim() || null,
        activities ? JSON.stringify(activities) : null,
        image_url?.trim() || null,
        ...scoreValues
      ]
    );

    const [newDestination] = await pool.execute(
      'SELECT * FROM destinations WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Destination created successfully',
      data: newDestination[0]
    });
  } catch (error) {
    console.error('Create destination error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Destination with this name already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create destination'
    });
  }
};

const updateDestination = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const scoreErrors = validateScores(req.body);
    if (scoreErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: scoreErrors
      });
    }

    const [existing] = await pool.execute('SELECT id FROM destinations WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const allowedFields = [
      'name', 'description', 'location', 'category', 'estimated_budget',
      'recommended_duration', 'best_time', 'activities', 'image_url',
      ...SCORE_FIELDS
    ];

    const updates = [];
    const params = [];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'activities') {
          params.push(req.body[field] ? JSON.stringify(req.body[field]) : null);
        } else if (SCORE_FIELDS.includes(field)) {
          params.push(parseInt(req.body[field]) || 0);
        } else if (field === 'estimated_budget') {
          params.push(req.body[field] ? parseFloat(req.body[field]) : null);
        } else if (field === 'recommended_duration') {
          params.push(req.body[field] ? parseInt(req.body[field]) : null);
        } else {
          params.push(req.body[field]?.trim() || null);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    params.push(id);
    await pool.execute(
      `UPDATE destinations SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await pool.execute('SELECT * FROM destinations WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Destination updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update destination error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Destination with this name already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update destination'
    });
  }
};

const deleteDestination = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const [existing] = await pool.execute('SELECT id FROM destinations WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const relatedChecks = [
      { table: 'travel_packages', field: 'destination_id' },
      { table: 'bookings', field: 'destination_id' },
      { table: 'reviews', field: 'destination_id' },
      { table: 'recommendations', field: 'destination_id' },
      { table: 'itineraries', field: 'destination_id' }
    ];

    const ALLOWED_RELATED_TABLES = new Set(['travel_packages', 'bookings', 'reviews', 'recommendations', 'itineraries']);
    const ALLOWED_RELATED_FIELDS = new Set(['destination_id']);

    for (const check of relatedChecks) {
      if (!ALLOWED_RELATED_TABLES.has(check.table) || !ALLOWED_RELATED_FIELDS.has(check.field)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid related table or field specified'
        });
      }
      const [rows] = await pool.execute(
        `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.field} = ?`,
        [id]
      );
      if (rows[0].count > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete destination: ${rows[0].count} related record(s) exist in ${check.table}`
        });
      }
    }

    await pool.execute('DELETE FROM destinations WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Destination deleted successfully'
    });
  } catch (error) {
    console.error('Delete destination error:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete destination due to foreign key constraints'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to delete destination'
    });
  }
};

module.exports = {
  getDestinations,
  getDestinationById,
  getDestinationPackages,
  createDestination,
  updateDestination,
  deleteDestination
};