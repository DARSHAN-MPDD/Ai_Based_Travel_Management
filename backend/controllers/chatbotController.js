const { pool } = require('../config/database');
const chatbotService = require('../services/chatbotService');

const sendMessage = async (req, res) => {
  try {
    const { message, session_id } = req.body;
    const userId = req.user ? req.user.id : null;

    try {
      const result = await chatbotService.processMessage(message, session_id, userId);

      return res.json({
        success: true,
        message: 'Chatbot response generated successfully',
        data: result
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }
  } catch (error) {
    console.error('Chatbot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your message'
    });
  }
};

const getSession = async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    const userId = req.user ? req.user.id : null;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const history = chatbotService.getSessionHistory(sessionId, userId);

    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    return res.json({
      success: true,
      message: 'Session retrieved successfully',
      data: {
        session_id: sessionId,
        messages: history
      }
    });
  } catch (error) {
    console.error('Chatbot get session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve session'
    });
  }
};

const clearSession = async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    const userId = req.user ? req.user.id : null;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const cleared = chatbotService.clearSession(sessionId, userId);

    if (!cleared) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    return res.json({
      success: true,
      message: 'Session cleared successfully',
      data: { session_id: sessionId }
    });
  } catch (error) {
    console.error('Chatbot clear session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear session'
    });
  }
};

module.exports = {
  sendMessage,
  getSession,
  clearSession
};
