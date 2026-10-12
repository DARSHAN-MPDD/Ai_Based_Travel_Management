const itineraryService = require('../services/itineraryService');
const { pool } = require('../config/database');

const validateItineraryRequest = (body) => {
  const errors = [];

  if (!body.destination_id) {
    errors.push('Destination ID is required');
  } else {
    const destId = parseInt(body.destination_id);
    if (isNaN(destId) || destId <= 0) {
      errors.push('Destination ID must be a positive integer');
    }
  }

  if (!body.duration) {
    errors.push('Duration is required');
  } else {
    const duration = parseInt(body.duration);
    if (isNaN(duration) || duration <= 0) {
      errors.push('Duration must be a positive integer');
    } else if (duration > 30) {
      errors.push('Duration cannot exceed 30 days');
    }
  }

  if (!body.budget) {
    errors.push('Budget is required');
  } else {
    const budget = parseFloat(body.budget);
    if (isNaN(budget) || budget <= 0) {
      errors.push('Budget must be a positive number');
    } else if (budget > 10000000) {
      errors.push('Budget cannot exceed ₹1,00,00,000');
    }
  }

  if (!body.travelers && body.travelers !== 0) {
    errors.push('Number of travelers is required');
  } else {
    const travelers = parseInt(body.travelers);
    if (isNaN(travelers) || travelers <= 0) {
      errors.push('Number of travelers must be a positive integer');
    } else if (travelers > 20) {
      errors.push('Number of travelers cannot exceed 20');
    }
  }

  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests)) {
      errors.push('Interests must be an array');
    } else {
      const invalidInterests = body.interests.filter(i => !itineraryService.VALID_INTERESTS.includes(i));
      if (invalidInterests.length > 0) {
        errors.push(`Invalid interests: ${invalidInterests.join(', ')}. Valid options: ${itineraryService.VALID_INTERESTS.join(', ')}`);
      }
    }
  }

  if (body.travel_type !== undefined && body.travel_type !== null && body.travel_type !== '') {
    if (!itineraryService.VALID_TRAVEL_TYPES.includes(body.travel_type)) {
      errors.push(`Invalid travel type. Valid options: ${itineraryService.VALID_TRAVEL_TYPES.join(', ')}`);
    }
  }

  if (body.pace !== undefined && body.pace !== null && body.pace !== '') {
    if (!itineraryService.VALID_PACES.includes(body.pace)) {
      errors.push(`Invalid pace. Valid options: ${itineraryService.VALID_PACES.join(', ')}`);
    }
  }

  if (body.start_date !== undefined && body.start_date !== null && body.start_date !== '') {
    const date = new Date(body.start_date);
    if (isNaN(date.getTime())) {
      errors.push('Start date must be a valid date (YYYY-MM-DD)');
    }
  }

  return errors;
};

const generateItinerary = async (req, res) => {
  try {
    const userId = req.user.id;
    const validationErrors = validateItineraryRequest(req.body);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const {
      destination_id,
      duration,
      budget,
      travelers,
      interests = [],
      travel_type = null,
      pace = 'balanced',
      start_date = null
    } = req.body;

    const itineraryData = await itineraryService.generateItinerary({
      userId,
      destinationId: parseInt(destination_id),
      duration: parseInt(duration),
      budget: parseFloat(budget),
      travelers: parseInt(travelers),
      interests,
      travelType: travel_type,
      pace,
      startDate: start_date
    });

    const itineraryId = await itineraryService.saveItinerary(userId, {
      ...itineraryData,
      interests,
      travel_type,
      pace
    });

    const savedItinerary = await itineraryService.getItineraryById(itineraryId, userId);

    return res.status(201).json({
      success: true,
      message: 'Itinerary generated successfully',
      data: {
        itinerary_id: savedItinerary.id,
        destination: {
          id: savedItinerary.destination.id,
          name: savedItinerary.destination.name
        },
        duration: savedItinerary.total_days,
        number_of_travelers: savedItinerary.travelers,
        budget: savedItinerary.budget,
        total_estimated_cost: savedItinerary.total_estimated_cost,
        budget_status: itineraryData.budget_status,
        budget_breakdown: itineraryData.budget_breakdown,
        budget_difference: itineraryData.budget_difference,
        suggestions: itineraryData.suggestions,
        assumptions: itineraryData.assumptions,
        pace: itineraryData.pace,
        match_score: itineraryData.match_score,
        days: savedItinerary.days.map(day => ({
          day_number: day.day_number,
          day_title: day.day_title,
          morning_activity: day.morning_activity,
          afternoon_activity: day.afternoon_activity,
          evening_activity: day.evening_activity,
          estimated_cost: day.estimated_cost,
          cost_breakdown: day.cost_breakdown,
          notes: day.notes
        }))
      }
    });
  } catch (error) {
    console.error('Generate itinerary error:', error);
    
    if (error.message === 'DESTINATION_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to generate itinerary'
    });
  }
};

const getItineraryById = async (req, res) => {
  try {
    const userId = req.user.id;
    const itineraryId = parseInt(req.params.id);

    if (isNaN(itineraryId) || itineraryId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid itinerary ID'
      });
    }

    const itinerary = await itineraryService.getItineraryById(itineraryId, userId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    const budgetParams = {
      destination: itinerary.destination,
      duration: itinerary.total_days,
      travelers: itinerary.travelers,
      userBudget: itinerary.budget,
      destinationEstimatedBudget: itinerary.destination.estimated_budget
    };
    const budgetResult = require('../services/budgetService').calculateBudgetBreakdown(budgetParams);

    return res.json({
      success: true,
      message: 'Itinerary retrieved successfully',
      data: {
        itinerary_id: itinerary.id,
        destination: {
          id: itinerary.destination.id,
          name: itinerary.destination.name,
          location: itinerary.destination.location,
          category: itinerary.destination.category,
          image_url: itinerary.destination.image_url,
          estimated_budget: itinerary.destination.estimated_budget
        },
        duration: itinerary.total_days,
        number_of_travelers: itinerary.travelers,
        budget: itinerary.budget,
        total_estimated_cost: itinerary.total_estimated_cost,
        budget_status: budgetResult.budget_status,
        budget_breakdown: budgetResult.breakdown,
        budget_difference: budgetResult.budget_difference,
        suggestions: budgetResult.suggestions,
        assumptions: budgetResult.assumptions,
        travel_type: itinerary.travel_type,
        pace: itinerary.pace || 'balanced',
        interests: itinerary.interests,
        start_date: itinerary.start_date,
        status: itinerary.status,
        created_at: itinerary.created_at,
        days: itinerary.days.map(day => ({
          day_number: day.day_number,
          day_title: day.day_title,
          morning_activity: day.morning_activity,
          afternoon_activity: day.afternoon_activity,
          evening_activity: day.evening_activity,
          estimated_cost: day.estimated_cost,
          cost_breakdown: day.cost_breakdown,
          notes: day.notes
        }))
      }
    });
  } catch (error) {
    console.error('Get itinerary by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve itinerary'
    });
  }
};

const getUserItineraries = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));

    const result = await itineraryService.getUserItineraries(userId, page, limit);

    return res.json({
      success: true,
      message: 'Itineraries retrieved successfully',
      data: result.data.map(itinerary => ({
        itinerary_id: itinerary.id,
        destination: {
          id: itinerary.destination_id,
          name: itinerary.dest_name,
          location: itinerary.dest_location,
          category: itinerary.dest_category,
          image_url: itinerary.dest_image
        },
        duration: itinerary.total_days,
        travelers: itinerary.travelers,
        budget: itinerary.budget,
        total_estimated_cost: itinerary.total_estimated_cost,
        status: itinerary.status,
        created_at: itinerary.created_at
      })),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get user itineraries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve itineraries'
    });
  }
};

module.exports = {
  generateItinerary,
  getItineraryById,
  getUserItineraries,
  validateItineraryRequest
};