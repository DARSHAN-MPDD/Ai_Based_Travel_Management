const recommendationService = require('../services/recommendationService');

const getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));

    const result = await recommendationService.getRecommendations(userId, limit);

    if (result.error) {
      const statusCode = result.error === 'PREFERENCES_NOT_FOUND' ? 400 : 404;
      return res.status(statusCode).json({
        success: false,
        message: result.message
      });
    }

    return res.json({
      success: true,
      message: 'Personalized recommendations generated successfully',
      data: result.recommendations
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations'
    });
  }
};

const getSavedRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pool } = require('../config/database');

    const [saved] = await pool.execute(
      `SELECT r.*, d.name, d.location, d.category, d.estimated_budget, 
              d.recommended_duration, d.image_url
       FROM recommendations r
       JOIN destinations d ON r.destination_id = d.id
       WHERE r.user_id = ?
       ORDER BY r.match_percentage DESC, r.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      message: 'Saved recommendations retrieved',
      data: saved
    });
  } catch (error) {
    console.error('Get saved recommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve saved recommendations'
    });
  }
};

module.exports = {
  getRecommendations,
  getSavedRecommendations
};