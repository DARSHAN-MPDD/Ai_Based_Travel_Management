const { pool } = require('../config/database');
const budgetService = require('./budgetService');

const VALID_INTERESTS = ['nature', 'adventure', 'beach', 'history', 'culture', 'food', 'photography', 'shopping'];
const VALID_TRAVEL_TYPES = ['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury'];

const ACTIVITY_TEMPLATES = {
  nature: {
    morning: ['Nature walk and bird watching', 'Sunrise viewpoint visit', 'Forest trail exploration', 'Botanical garden tour'],
    afternoon: ['Wildlife sanctuary visit', 'Nature photography session', 'Waterfall visit', 'Lake boating', 'Eco-park exploration'],
    evening: ['Sunset at viewpoint', 'Campfire and stargazing', 'Nature documentary screening', 'Guided night walk']
  },
  adventure: {
    morning: ['Trekking to peak', 'Rock climbing session', 'River rafting', 'Zip lining adventure', 'Mountain biking'],
    afternoon: ['Adventure park activities', 'Paragliding', 'Canyoning', 'ATV off-road ride', 'Bungee jumping'],
    evening: ['Campfire with adventure stories', 'Night trek', 'Adventure gear showcase', 'Relax at base camp']
  },
  beach: {
    morning: ['Beach sunrise walk', 'Swimming and sunbathing', 'Beach volleyball', 'Snorkeling', 'Kayaking'],
    afternoon: ['Beach hopping tour', 'Scuba diving', 'Jet skiing', 'Beachside lunch', 'Sandcastle building'],
    evening: ['Sunset beach dinner', 'Bonfire on beach', 'Night beach walk', 'Beach party']
  },
  history: {
    morning: ['Historic fort/palace guided tour', 'Archaeological site visit', 'Heritage museum tour', 'Ancient temple exploration'],
    afternoon: ['Historical walking tour', 'Monument photography', 'Heritage craft workshop', 'Cultural heritage center visit'],
    evening: ['Sound and light show', 'Historic district evening walk', 'Traditional cultural performance', 'Heritage hotel stay']
  },
  culture: {
    morning: ['Local village cultural tour', 'Traditional craft workshop', 'Cooking class with locals', 'Temple/religious site visit'],
    afternoon: ['Art gallery and museum visit', 'Cultural festival participation', 'Music and dance workshop', 'Local market exploration'],
    evening: ['Cultural dinner with local family', 'Folk music and dance performance', 'Traditional storytelling', 'Night market visit']
  },
  food: {
    morning: ['Local breakfast tasting tour', 'Market visit for fresh ingredients', 'Cooking class', 'Food history walking tour'],
    afternoon: ['Restaurant hopping lunch', 'Street food tour', 'Winery/brewery visit', 'Farm to table experience'],
    evening: ['Fine dining experience', 'Food festival visit', 'Night market food crawl', 'Cooking demonstration dinner']
  },
  photography: {
    morning: ['Golden hour landscape photography', 'Architecture photography walk', 'Wildlife photography safari', 'Street photography session'],
    afternoon: ['Portrait photography with locals', 'Macro photography workshop', 'Drone photography session', 'Long exposure practice'],
    evening: ['Blue hour cityscape photography', 'Astrophotography session', 'Light painting workshop', 'Photo review and editing']
  },
  shopping: {
    morning: ['Local artisan market visit', 'Handicraft workshop tour', 'Textile factory visit', 'Antique shop browsing'],
    afternoon: ['Designer boutique shopping', 'Souvenir hunting', 'Jewelry making workshop', 'Spice market exploration'],
    evening: ['Night market shopping', 'Duty free shopping', 'Local mall visit', 'Shopping street walk']
  }
};

const DEFAULT_ACTIVITIES = {
  morning: ['Explore local attractions', 'Visit main landmark', 'Guided city tour'],
  afternoon: ['Lunch at local restaurant', 'Free time for exploration', 'Visit museum or gallery'],
  evening: ['Dinner at recommended restaurant', 'Evening walk', 'Relax at accommodation']
};

function getActivitiesForInterest(interest, timeOfDay) {
  const templates = ACTIVITY_TEMPLATES[interest];
  if (templates && templates[timeOfDay] && templates[timeOfDay].length > 0) {
    return templates[timeOfDay];
  }
  return DEFAULT_ACTIVITIES[timeOfDay] || ['Enjoy your free time'];
}

function selectActivities(interests, travelType, destination, duration, dayNumber) {
  const timeSlots = ['morning', 'afternoon', 'evening'];
  const selected = {};
  
  const primaryInterests = interests.length > 0 ? interests : 
    (destination.category === 'Hill Station' ? ['nature', 'adventure'] :
     destination.category === 'Beach' ? ['beach', 'relaxation'] :
     destination.category === 'Heritage' ? ['history', 'culture'] :
     destination.category === 'Adventure' ? ['adventure'] :
     destination.category === 'Backwaters' ? ['nature', 'culture'] :
     ['nature', 'culture']);

  const allRelevantInterests = [...new Set([...primaryInterests, ...(travelType ? [travelType] : [])])]
    .filter(i => VALID_INTERESTS.includes(i) || VALID_TRAVEL_TYPES.includes(i));

  timeSlots.forEach(slot => {
    const activities = [];
    const usedActivities = new Set();
    
    allRelevantInterests.forEach(interest => {
      const pool = getActivitiesForInterest(interest, slot);
      pool.forEach(activity => {
        const normalized = activity.toLowerCase();
        if (!usedActivities.has(normalized) && activities.length < 3) {
          activities.push(activity);
          usedActivities.add(normalized);
        }
      });
    });

    if (activities.length === 0) {
      activities.push(...DEFAULT_ACTIVITIES[slot].slice(0, 2));
    }

    selected[slot] = activities.slice(0, 2);
  });

  return selected;
}

function generateDayTitle(dayNumber, duration, destination, travelType) {
  if (dayNumber === 1) return 'Arrival and Exploration';
  if (dayNumber === duration) return 'Departure and Farewell';
  
  const typeLabels = {
    nature: 'Nature Discovery',
    adventure: 'Adventure Day',
    beach: 'Beach Bliss',
    history: 'Heritage Exploration',
    culture: 'Cultural Immersion',
    food: 'Culinary Journey',
    photography: 'Photography Expedition',
    shopping: 'Shopping Spree',
    relaxation: 'Relaxation Day',
    wildlife: 'Wildlife Safari'
  };
  
  return typeLabels[travelType] || `Day ${dayNumber} Exploration`;
}

function generateNotes(dayNumber, duration, destination, activities) {
  const notes = [];
  
  if (dayNumber === 1) {
    notes.push('Arrive at destination and check into accommodation');
    notes.push('Allow time for acclimatization and rest');
  }
  
  if (dayNumber === duration) {
    notes.push('Check out from accommodation');
    notes.push('Allow buffer time for departure travel');
  }
  
  if (destination.category === 'Hill Station' && dayNumber > 1) {
    notes.push('Carry warm clothing for temperature changes');
    notes.push('Stay hydrated at higher altitudes');
  }
  
  if (destination.category === 'Beach') {
    notes.push('Apply sunscreen and stay hydrated');
    notes.push('Respect local beach regulations');
  }
  
  if (activities.morning.some(a => a.toLowerCase().includes('trek') || a.toLowerCase().includes('hike'))) {
    notes.push('Wear comfortable trekking shoes');
    notes.push('Carry water and snacks for outdoor activities');
  }
  
  if (activities.afternoon.some(a => a.toLowerCase().includes('water') || a.toLowerCase().includes('swim') || a.toLowerCase().includes('raft'))) {
    notes.push('Bring swimwear and towel for water activities');
    notes.push('Follow safety instructions from guides');
  }
  
  notes.push('Keep emergency contacts and local guide information handy');
  
  return notes.join('. ') + '.';
}

async function getDestinationById(destinationId) {
  const [rows] = await pool.execute(
    `SELECT id, name, description, location, category, estimated_budget,
            recommended_duration, best_time, activities, image_url,
            nature_score, adventure_score, beach_score, history_score,
            culture_score, food_score, photography_score, shopping_score
     FROM destinations WHERE id = ? AND is_active = TRUE`,
    [destinationId]
  );
  return rows[0] || null;
}

function parseDestinationActivities(destination) {
  if (!destination.activities) return [];
  try {
    return JSON.parse(destination.activities);
  } catch {
    return [];
  }
}

async function generateItinerary(params) {
  const {
    userId,
    destinationId,
    duration,
    budget,
    travelers,
    interests = [],
    travelType = null,
    startDate = null
  } = params;

  const destination = await getDestinationById(destinationId);
  if (!destination) {
    throw new Error('DESTINATION_NOT_FOUND');
  }

  const destActivities = parseDestinationActivities(destination);
  
  const days = [];
  for (let day = 1; day <= duration; day++) {
    const activities = selectActivities(interests, travelType, destination, duration, day);
    const dayTitle = generateDayTitle(day, duration, destination, travelType);
    const notes = generateNotes(day, duration, destination, activities);
    
    days.push({
      day_number: day,
      day_title: dayTitle,
      morning_activity: activities.morning.join('; '),
      afternoon_activity: activities.afternoon.join('; '),
      evening_activity: activities.evening.join('; '),
      notes
    });
  }

  const budgetParams = {
    destination,
    duration,
    travelers,
    userBudget: budget,
    destinationEstimatedBudget: destination.estimated_budget
  };
  const budgetResult = budgetService.calculateBudgetBreakdown(budgetParams);

  const dayCosts = budgetService.calculateItineraryDayCosts(
    days,
    budgetResult.breakdown,
    destination.estimated_budget,
    duration,
    travelers
  );

  days.forEach((day, index) => {
    day.estimated_cost = dayCosts[index].estimated_cost;
  });

  const totalEstimatedCost = budgetResult.total_estimated_cost;

  return {
    destination,
    duration,
    travelers,
    budget,
    total_estimated_cost: totalEstimatedCost,
    budget_status: budgetResult.budget_status,
    budget_breakdown: budgetResult.breakdown,
    budget_difference: budgetResult.budget_difference,
    suggestions: budgetResult.suggestions,
    assumptions: budgetResult.assumptions,
    days,
    start_date: startDate
  };
}

async function saveItinerary(userId, itineraryData) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [itineraryResult] = await connection.execute(
      `INSERT INTO itineraries (
        user_id, destination_id, destination_name, total_days, budget,
        travelers, interests, travel_type, total_estimated_cost, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalized')`,
      [
        userId,
        itineraryData.destination.id,
        itineraryData.destination.name,
        itineraryData.duration,
        itineraryData.budget,
        itineraryData.travelers,
        JSON.stringify(itineraryData.interests || []),
        itineraryData.travel_type || null,
        itineraryData.total_estimated_cost
      ]
    );

    const itineraryId = itineraryResult.insertId;

    for (const day of itineraryData.days) {
      await connection.execute(
        `INSERT INTO itinerary_days (
          itinerary_id, day_number, morning_activity, afternoon_activity,
          evening_activity, estimated_cost, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itineraryId,
          day.day_number,
          day.morning_activity,
          day.afternoon_activity,
          day.evening_activity,
          day.estimated_cost,
          day.notes
        ]
      );
    }

    await connection.commit();
    return itineraryId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function parseInterests(interestsStr) {
  if (!interestsStr) return [];
  if (Array.isArray(interestsStr)) return interestsStr;
  try {
    return JSON.parse(interestsStr);
  } catch {
    return interestsStr.split(',').map(s => s.trim()).filter(Boolean);
  }
}

async function getItineraryById(itineraryId, userId) {
  const [itineraries] = await pool.execute(
    `SELECT i.*, d.name as dest_name, d.location as dest_location, d.category as dest_category,
            d.image_url as dest_image, d.estimated_budget as dest_estimated_budget
     FROM itineraries i
     JOIN destinations d ON i.destination_id = d.id
     WHERE i.id = ? AND i.user_id = ?`,
    [itineraryId, userId]
  );

  if (itineraries.length === 0) {
    return null;
  }

  const itinerary = itineraries[0];

  const [days] = await pool.execute(
    `SELECT day_number, day_title, morning_activity, afternoon_activity,
            evening_activity, estimated_cost, notes
     FROM itinerary_days
     WHERE itinerary_id = ?
     ORDER BY day_number ASC`,
    [itineraryId]
  );

  return {
    ...itinerary,
    destination: {
      id: itinerary.destination_id,
      name: itinerary.dest_name,
      location: itinerary.dest_location,
      category: itinerary.dest_category,
      image_url: itinerary.dest_image,
      estimated_budget: itinerary.dest_estimated_budget
    },
    days,
    interests: parseInterests(itinerary.interests)
  };
}

async function getUserItineraries(userId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [countResult] = await pool.execute(
    'SELECT COUNT(*) as total FROM itineraries WHERE user_id = ?',
    [userId]
  );
  const total = countResult[0].total;

  const [itineraries] = await pool.execute(
    `SELECT i.id, i.destination_id, i.destination_name, i.total_days, i.budget,
            i.travelers, i.total_estimated_cost, i.status, i.created_at,
            d.name as dest_name, d.location as dest_location, d.category as dest_category,
            d.image_url as dest_image
     FROM itineraries i
     JOIN destinations d ON i.destination_id = d.id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  return {
    data: itineraries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  generateItinerary,
  saveItinerary,
  getItineraryById,
  getUserItineraries,
  VALID_INTERESTS,
  VALID_TRAVEL_TYPES
};