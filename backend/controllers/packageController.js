const { pool } = require('../config/database');

const getPackages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      destinationId,
      minPrice,
      maxPrice,
      duration,
      sort = 'price_asc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE tp.is_active = TRUE AND d.is_active = TRUE';
    const params = [];

    if (search) {
      whereClause += ' AND (tp.name LIKE ? OR tp.description LIKE ? OR d.name LIKE ? OR d.location LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (destinationId) {
      whereClause += ' AND tp.destination_id = ?';
      params.push(parseInt(destinationId));
    }

    if (minPrice !== undefined) {
      whereClause += ' AND tp.price_per_person >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice !== undefined) {
      whereClause += ' AND tp.price_per_person <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (duration !== undefined) {
      whereClause += ' AND tp.duration_days = ?';
      params.push(parseInt(duration));
    }

    let orderClause = 'ORDER BY tp.price_per_person ASC';
    switch (sort) {
      case 'price_desc':
        orderClause = 'ORDER BY tp.price_per_person DESC';
        break;
      case 'price_asc':
        orderClause = 'ORDER BY tp.price_per_person ASC';
        break;
      case 'name':
        orderClause = 'ORDER BY tp.name ASC';
        break;
      case 'duration':
        orderClause = 'ORDER BY tp.duration_days ASC';
        break;
      default:
        orderClause = 'ORDER BY tp.price_per_person ASC';
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM travel_packages tp
      JOIN destinations d ON tp.destination_id = d.id
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitNum);

    const selectQuery = `
      SELECT tp.id, tp.destination_id, tp.name, tp.description, tp.duration_days,
             tp.price_per_person, tp.inclusions, tp.exclusions, tp.image_url,
             tp.max_travelers, tp.is_active, tp.created_at, tp.updated_at,
             d.name as destination_name, d.location as destination_location,
             d.category as destination_category, d.image_url as destination_image
      FROM travel_packages tp
      JOIN destinations d ON tp.destination_id = d.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const selectParams = [...params, limitNum, offset];
    const [packages] = await pool.execute(selectQuery, selectParams);

    return res.json({
      success: true,
      message: 'Packages retrieved successfully',
      data: packages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get packages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve packages'
    });
  }
};

const getPackageById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    const [packages] = await pool.execute(
      `SELECT tp.id, tp.destination_id, tp.name, tp.description, tp.duration_days,
              tp.price_per_person, tp.inclusions, tp.exclusions, tp.image_url,
              tp.max_travelers, tp.is_active, tp.created_at, tp.updated_at,
              d.name as destination_name, d.location as destination_location,
              d.category as destination_category, d.description as destination_description,
              d.image_url as destination_image
       FROM travel_packages tp
       JOIN destinations d ON tp.destination_id = d.id
       WHERE tp.id = ?`,
      [id]
    );

    if (packages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    return res.json({
      success: true,
      message: 'Package retrieved successfully',
      data: packages[0]
    });
  } catch (error) {
    console.error('Get package by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve package'
    });
  }
};

const createPackage = async (req, res) => {
  try {
    const {
      destination_id, name, description, duration_days,
      price_per_person, inclusions, exclusions, image_url, max_travelers
    } = req.body;

    if (!destination_id || !name || !duration_days || !price_per_person) {
      return res.status(400).json({
        success: false,
        message: 'Destination ID, name, duration, and price are required'
      });
    }

    if (isNaN(destination_id) || destination_id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination ID'
      });
    }

    const [destinations] = await pool.execute(
      'SELECT id FROM destinations WHERE id = ? AND is_active = TRUE',
      [destination_id]
    );

    if (destinations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Destination not found or inactive'
      });
    }

    if (isNaN(duration_days) || duration_days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be a positive integer'
      });
    }

    if (isNaN(price_per_person) || price_per_person <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }

    if (max_travelers !== undefined && (isNaN(max_travelers) || max_travelers <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Max travelers must be a positive integer'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO travel_packages (
        destination_id, name, description, duration_days,
        price_per_person, inclusions, exclusions, image_url, max_travelers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(destination_id),
        name.trim(),
        description?.trim() || null,
        parseInt(duration_days),
        parseFloat(price_per_person),
        inclusions ? JSON.stringify(inclusions) : null,
        exclusions ? JSON.stringify(exclusions) : null,
        image_url?.trim() || null,
        max_travelers ? parseInt(max_travelers) : 10
      ]
    );

    const [newPackage] = await pool.execute(
      `SELECT tp.*, d.name as destination_name
       FROM travel_packages tp
       JOIN destinations d ON tp.destination_id = d.id
       WHERE tp.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: newPackage[0]
    });
  } catch (error) {
    console.error('Create package error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create package'
    });
  }
};

const updatePackage = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    const [existing] = await pool.execute('SELECT id FROM travel_packages WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const allowedFields = [
      'destination_id', 'name', 'description', 'duration_days',
      'price_per_person', 'inclusions', 'exclusions', 'image_url', 'max_travelers', 'is_active'
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'destination_id') {
          if (req.body[field] !== null) {
            const [dest] = await pool.execute(
              'SELECT id FROM destinations WHERE id = ? AND is_active = TRUE',
              [req.body[field]]
            );
            if (dest.length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Destination not found or inactive'
              });
            }
          }
          updates.push(`${field} = ?`);
          params.push(req.body[field] ? parseInt(req.body[field]) : null);
        } else if (field === 'duration_days') {
          if (req.body[field] !== null && (isNaN(req.body[field]) || req.body[field] <= 0)) {
            return res.status(400).json({
              success: false,
              message: 'Duration must be a positive integer'
            });
          }
          updates.push(`${field} = ?`);
          params.push(req.body[field] ? parseInt(req.body[field]) : null);
        } else if (field === 'price_per_person') {
          if (req.body[field] !== null && (isNaN(req.body[field]) || req.body[field] <= 0)) {
            return res.status(400).json({
              success: false,
              message: 'Price must be a positive number'
            });
          }
          updates.push(`${field} = ?`);
          params.push(req.body[field] ? parseFloat(req.body[field]) : null);
        } else if (field === 'max_travelers') {
          if (req.body[field] !== null && (isNaN(req.body[field]) || req.body[field] <= 0)) {
            return res.status(400).json({
              success: false,
              message: 'Max travelers must be a positive integer'
            });
          }
          updates.push(`${field} = ?`);
          params.push(req.body[field] ? parseInt(req.body[field]) : null);
        } else if (field === 'inclusions' || field === 'exclusions') {
          updates.push(`${field} = ?`);
          params.push(req.body[field] ? JSON.stringify(req.body[field]) : null);
        } else if (field === 'is_active') {
          updates.push(`${field} = ?`);
          params.push(Boolean(req.body[field]));
        } else {
          updates.push(`${field} = ?`);
          params.push(req.body[field]?.trim() || null);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    params.push(id);
    await pool.execute(
      `UPDATE travel_packages SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await pool.execute(
      `SELECT tp.*, d.name as destination_name
       FROM travel_packages tp
       JOIN destinations d ON tp.destination_id = d.id
       WHERE tp.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Package updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update package error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update package'
    });
  }
};

const deletePackage = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    const [existing] = await pool.execute('SELECT id FROM travel_packages WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const [bookings] = await pool.execute(
      'SELECT COUNT(*) as count FROM bookings WHERE package_id = ?',
      [id]
    );

    if (bookings[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete package: ${bookings[0].count} related booking(s) exist`
      });
    }

    await pool.execute('DELETE FROM travel_packages WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    console.error('Delete package error:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete package due to foreign key constraints'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to delete package'
    });
  }
};

module.exports = {
  getPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage
};