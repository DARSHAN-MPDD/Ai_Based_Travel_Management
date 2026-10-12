const { pool } = require('../config/database');
const budgetService = require('./budgetService');
const { spawn } = require('child_process');
const path = require('path');

const VALID_INTERESTS = ['nature', 'adventure', 'beach', 'history', 'culture', 'food', 'photography', 'shopping'];
const VALID_TRAVEL_TYPES = ['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury'];
const VALID_PACES = ['relaxed', 'balanced', 'packed'];

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

const PACE_CONFIG = {
  relaxed: { activities_per_slot: 1, max_activities_per_day: 3 },
  balanced: { activities_per_slot: 2, max_activities_per_day: 6 },
  packed: { activities_per_slot: 3, max_activities_per_day: 9 }
};

function getActivitiesForInterest(interest, timeOfDay) {
  const templates = ACTIVITY_TEMPLATES[interest];
  if (templates && templates[timeOfDay] && templates[timeOfDay].length > 0) {
    return templates[timeOfDay];
  }
  return DEFAULT_ACTIVITIES[timeOfDay] || ['Enjoy your free time'];
}

function selectActivities(interests, travelType, destination, duration, dayNumber, pace = 'balanced') {
  const timeSlots = ['morning', 'afternoon', 'evening'];
  const selected = {};
  
  const paceCfg = PACE_CONFIG[pace] || PACE_CONFIG.balanced;
  const maxPerSlot = paceCfg.activities_per_slot;
  
  const primaryInterests = interests.length > 0 ? interests : 
    (destination.category === 'Hill Station' ? ['nature', 'adventure'] :
     destination.category === 'Beach' ? ['beach', 'relaxation'] :
     destination.category === 'Heritage' ? ['history', 'culture'] :
     destination.category === 'Adventure' ? ['adventure'] :
     destination.category === 'Backwaters' ? ['nature', 'culture'] :
     ['nature', 'culture']);

  const allRelevantInterests = [...new Set([...primaryInterests, ...(travelType ? [travelType] : [])])]
    .filter(i => VALID_INTERESTS.includes(i) || VALID_TRAVEL_TYPES.includes(i));

  const DESTINATION_INTEREST_SCORES = {
    'Hill Station': {'nature': 90, 'adventure': 70, 'beach': 10, 'history': 40, 'culture': 60, 'food': 70, 'photography': 85, 'shopping': 50},
    'Beach': {'nature': 60, 'adventure': 50, 'beach': 95, 'history': 60, 'culture': 55, 'food': 70, 'photography': 80, 'shopping': 40},
    'Heritage': {'nature': 30, 'adventure': 40, 'beach': 10, 'history': 95, 'culture': 90, 'food': 80, 'photography': 75, 'shopping': 85},
    'Adventure': {'nature': 80, 'adventure': 95, 'beach': 10, 'history': 40, 'culture': 55, 'food': 65, 'photography': 80, 'shopping': 50},
    'Backwaters': {'nature': 85, 'adventure': 30, 'beach': 60, 'history': 50, 'culture': 75, 'food': 80, 'photography': 80, 'shopping': 45},
    'Wildlife': {'nature': 95, 'adventure': 85, 'beach': 5, 'history': 30, 'culture': 50, 'food': 60, 'photography': 90, 'shopping': 30},
    'Desert': {'nature': 70, 'adventure': 80, 'beach': 10, 'history': 60, 'culture': 75, 'food': 70, 'photography': 85, 'shopping': 60},
    'Spiritual': {'nature': 50, 'adventure': 20, 'beach': 10, 'history': 70, 'culture': 90, 'food': 60, 'photography': 65, 'shopping': 55},
    'default': {'nature': 50, 'adventure': 50, 'beach': 50, 'history': 50, 'culture': 50, 'food': 50, 'photography': 50, 'shopping': 50}
  };
  
  const destScores = DESTINATION_INTEREST_SCORES[destination.category] || DESTINATION_INTEREST_SCORES.default;

  timeSlots.forEach(slot => {
    const activities = [];
    const usedActivities = new Set();
    
    const scoredInterests = [...allRelevantInterests].sort((a, b) => 
      (destScores[b] || 50) - (destScores[a] || 50)
    );
    
    scoredInterests.forEach(interest => {
      const pool = getActivitiesForInterest(interest, slot);
      pool.forEach(activity => {
        const normalized = activity.toLowerCase();
        if (!usedActivities.has(normalized) && activities.length < maxPerSlot) {
          activities.push(activity);
          usedActivities.add(normalized);
        }
      });
    });

    if (activities.length === 0) {
      activities.push(...DEFAULT_ACTIVITIES[slot].slice(0, maxPerSlot));
    }

    selected[slot] = activities.slice(0, maxPerSlot);
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
  
  const allActs = [
    ...activities.morning, 
    ...activities.afternoon, 
    ...activities.evening
  ].join(' ').toLowerCase();
  
  if (allActs.includes('trek') || allActs.includes('hike') || allActs.includes('climb')) {
    notes.push('Wear comfortable trekking shoes');
    notes.push('Carry water and snacks for outdoor activities');
  }
  
  if (allActs.includes('water') || allActs.includes('swim') || allActs.includes('raft') || 
      allActs.includes('kayak') || allActs.includes('snorkel') || allActs.includes('dive') || allActs.includes('boat')) {
    notes.push('Bring swimwear and towel for water activities');
    notes.push('Follow safety instructions from guides');
  }
  
  if (allActs.includes('photo') || allActs.includes('shoot') || allActs.includes('photography')) {
    notes.push('Carry extra batteries and memory cards');
    notes.push('Golden hour (sunrise/sunset) offers best lighting');
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

function runPythonItinerary(inputData) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', 'ai', 'itinerary.py');
    const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
    
    const child = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdin.write(JSON.stringify(inputData));
    child.stdin.end();
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve({ ...result, source: 'python' });
          }
        } catch (e) {
          reject(new Error('Failed to parse Python output: ' + e.message));
        }
      } else {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (err) => {
      reject(new Error('Failed to spawn Python process: ' + err.message));
    });
    
    setTimeout(() => {
      child.kill();
      reject(new Error('Python script timeout'));
    }, 30000);
  });
}

async function generateItineraryWithPython(params) {
  const {
    userId,
    destinationId,
    duration,
    budget,
    travelers,
    interests = [],
    travelType = null,
    startDate = null,
    pace = 'balanced'
  } = params;

  const destination = await getDestinationById(destinationId);
  if (!destination) {
    throw new Error('DESTINATION_NOT_FOUND');
  }

  const pythonInput = {
    userId,
    destinationId,
    duration,
    budget,
    travelers,
    interests,
    travelType,
    startDate,
    pace,
    destination: {
      id: destination.id,
      name: destination.name,
      description: destination.description,
      location: destination.location,
      category: destination.category,
      estimated_budget: destination.estimated_budget,
      recommended_duration: destination.recommended_duration,
      best_time: destination.best_time,
      activities: destination.activities,
      image_url: destination.image_url,
      nature_score: destination.nature_score,
      adventure_score: destination.adventure_score,
      beach_score: destination.beach_score,
      history_score: destination.history_score,
      culture_score: destination.culture_score,
      food_score: destination.food_score,
      photography_score: destination.photography_score,
      shopping_score: destination.shopping_score
    }
  };

  try {
    const pythonResult = await runPythonItinerary(pythonInput);
    
    const dayCosts = budgetService.calculateItineraryDayCosts(
      pythonResult.days,
      pythonResult.budget_breakdown,
      destination.estimated_budget,
      duration,
      travelers
    );

    pythonResult.days.forEach((day, index) => {
      day.estimated_cost = dayCosts[index].estimated_cost;
    });

    return {
      ...pythonResult,
      total_estimated_cost: pythonResult.total_estimated_cost,
      budget_status: pythonResult.budget_status,
      budget_breakdown: pythonResult.budget_breakdown,
      budget_difference: pythonResult.budget_difference,
      suggestions: pythonResult.suggestions,
      assumptions: pythonResult.assumptions,
      days: pythonResult.days,
      start_date: startDate
    };
  } catch (pythonError) {
    console.warn('Python AI failed, falling back to Node.js:', pythonError.message);
    return generateItineraryWithNode(params);
  }
}

async function generateItineraryWithNode(params) {
  const {
    userId,
    destinationId,
    duration,
    budget,
    travelers,
    interests = [],
    travelType = null,
    startDate = null,
    pace = 'balanced'
  } = params;

  const destination = await getDestinationById(destinationId);
  if (!destination) {
    throw new Error('DESTINATION_NOT_FOUND');
  }

  const destActivities = parseDestinationActivities(destination);
  
  const days = [];
  for (let day = 1; day <= duration; day++) {
    const activities = selectActivities(interests, travelType, destination, duration, day, pace);
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
      day.cost_breakdown = dayCosts[index].cost_breakdown;
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
    start_date: startDate,
    pace,
    match_score: 75,
    source: 'nodejs'
  };
}

async function generateItinerary(params) {
  try {
    return await generateItineraryWithPython(params);
  } catch (error) {
    console.warn('Falling back to Node.js itinerary generation:', error.message);
    return await generateItineraryWithNode(params);
  }
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
  VALID_TRAVEL_TYPES,
  VALID_PACES
};