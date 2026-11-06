const { pool } = require('../config/database');
const recommendationService = require('./recommendationService');
const itineraryService = require('./itineraryService');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const REVIEW_RATINGS = [5, 4, 3, 2, 1];

let sessionStore = new Map();

function createSession(userId) {
  return {
    id: generateSessionId(),
    userId: userId || null,
    messages: [],
    createdAt: Date.now()
  };
}

function generateSessionId() {
  return 'chat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function getSession(sessionId, userId) {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.userId !== userId) {
    return null;
  }

  return session;
}

function getOrCreateSession(sessionId, userId) {
  if (sessionId) {
    const existing = getSession(sessionId, userId);
    if (existing) {
      return existing;
    }
  }

  const session = createSession(userId);
  sessionStore.set(session.id, session);
  return session;
}

function addMessage(session, role, content, metadata = {}) {
  session.messages.push({ role, content, timestamp: Date.now(), ...metadata });

  if (session.messages.length > MAX_HISTORY_MESSAGES) {
    session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES);
  }
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[₹$]/g, ' rs ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBudget(text) {
  const match = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (match) {
    const value = parseFloat(match[0].replace(/,/g, ''));
    if (!isNaN(value) && value > 100) {
      return value;
    }
  }

  const numMatch = text.match(/(\d+)\s*(?:rs|rupee|rupees|inr|₹|\$)?/i);
  if (numMatch) {
    const value = parseInt(numMatch[1]);
    if (value > 100 && value <= 1000000) {
      return value;
    }
  }
  return null;
}

function extractDuration(text) {
  const patterns = [
    /(\d+)\s*(?:day|days)/i,
    /(\d+)\s*(?:night|nights)/i,
    /(\d+)\s*day/i,
    /(\d+)\s*night/i,
    /(\d+)\s*(?:d)\b/i,
    /three\s*day/i,
    /two\s*day/i,
    /one\s*day/i,
    /four\s*day/i,
    /five\s*day/i,
    /seven\s*day/i,
    /one\s*week/i,
    /two\s*week/i,
    /week/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].includes('three')) return 3;
      if (match[0].includes('two')) {
        if (match[0].includes('week')) return 14;
        return 2;
      }
      if (match[0].includes('one')) {
        if (match[0].includes('week')) return 7;
        return 1;
      }
      if (match[0].includes('four')) return 4;
      if (match[0].includes('five')) return 5;
      if (match[0].includes('seven')) return 7;
      if (match[0].includes('week')) return 7;
      if (match[1]) return parseInt(match[1]);
    }
  }
  return null;
}

function extractDestinationName(text) {
  const normalized = normalizeText(text);

  const patterns = [
    /tell me about\s+(.+?)(?:\?|$)/i,
    /reviews?\s+(?:for|on)\s+(.+?)(?:\?|$)/i,
    /rating\s+(?:for|of)\s+(.+?)(?:\?|$)/i,
    /about\s+(.+?)(?:\?|$)/i,
    /reviews?\s+for\s+(.+?)(?:\?|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function extractLocation(text) {
  const normalized = normalizeText(text);

  const locationKeywords = ['karnataka', 'kerala', 'tamil nadu', 'andhra pradesh', 'goa', 'rajasthan', 'himachal', 'uttarakhand', 'punjab', 'uttar pradesh', 'maharashtra', 'gujarat', 'odisha', 'west bengal'];

  for (const loc of locationKeywords) {
    if (normalized.includes(loc)) {
      return loc.charAt(0).toUpperCase() + loc.slice(1);
    }
  }
  return null;
}

function extractInterest(text) {
  const normalized = normalizeText(text);

  const interests = {
    nature: ['nature', 'natural', 'scenic', 'beautiful', 'forest', 'mountain', 'valley', 'hill'],
    adventure: ['adventure', 'trekking', 'hiking', 'rafting', 'adventure'],
    beach: ['beach', 'beachside', 'coastal', 'seaside', 'ocean'],
    heritage: ['heritage', 'historic', 'history', 'ancient', 'fort', 'palace', 'temple'],
    culture: ['culture', 'cultural', 'tradition', 'local', 'festival', 'art'],
    food: ['food', 'cuisine', 'restaurant', 'dish', 'cooking'],
    photography: ['photography', 'photo', 'camera', 'pictures'],
    shopping: ['shopping', 'market', 'mall', 'souvenir']
  };

  const matched = [];
  for (const [interest, keywords] of Object.entries(interests)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      matched.push(interest);
    }
  }

  return matched.length > 0 ? matched : null;
}

function extractTravelType(text) {
  const normalized = normalizeText(text);
  const types = ['family', 'couple', 'honeymoon', 'solo', 'friends', 'budget', 'luxury'];

  for (const type of types) {
    if (normalized.includes(type)) {
      return type;
    }
  }
  return null;
}

function classifyIntent(text) {
  const normalized = normalizeText(text);

  if (normalized.includes('tell me about')) {
    return 'destination_details';
  }

  if (normalized.includes('recommend') || normalized.includes('suggest') || normalized.includes('what should') || normalized.includes('best place') || normalized.includes('what is the best')) {
    return 'recommendations';
  }

  if (normalized.includes('itinerary') || normalized.includes('plan a trip') || normalized.includes('plan my trip') || normalized.includes('trip plan') || /plan\s+(?:a|my|me|for)?\s*.*\s*trip/i.test(normalized)) {
    return 'itinerary_help';
  }

  if (normalized.includes('booking') || normalized.includes('my booking') || normalized.includes('booking status') || normalized.includes('booking history')) {
    return 'booking_status';
  }

  if (normalized.includes('review') || normalized.includes('rating') || normalized.includes('ratings')) {
    return 'review_summary';
  }

  if (normalized.includes('package') || normalized.includes('packages')) {
    return 'package_search';
  }

  if (normalized.includes('preference') || normalized.includes('saved preference') || normalized.includes('my preference')) {
    return 'preferences';
  }

  if (extractBudget(text) && extractDuration(text)) {
    return 'budget_itinerary';
  }

  if (normalized.includes('budget') || normalized.includes('within') || normalized.includes('under') || normalized.includes('afford')) {
    return 'budget_planning';
  }

  if (normalized.includes('destination') || normalized.includes('place') || normalized.includes('places') || normalized.includes('where') || normalized.includes('visit')) {
    const location = extractLocation(text);
    if (location) return 'destination_search';
    return 'destination_details';
  }

  if (normalized.includes('tip') || normalized.includes('advice') || normalized.includes('help') || normalized.includes('how to') || normalized.includes('travel guide')) {
    return 'general_travel_help';
  }

  return 'unknown';
}

async function searchDestinations(criteria) {
  const { location, interest, budget, duration, search } = criteria;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push(`(name LIKE ? OR location LIKE ? OR description LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (location) {
    conditions.push(`location LIKE ?`);
    params.push(`%${location}%`);
  }

  if (budget) {
    conditions.push(`estimated_budget <= ?`);
    params.push(budget);
  }

  if (conditions.length > 0) {
    conditions.push('is_active = TRUE');
  } else {
    conditions.push('is_active = TRUE');
  }

  let scoreOrder = '';

  const [destinations] = await pool.execute(
    `SELECT id, name, location, category, estimated_budget, recommended_duration, image_url
     FROM destinations
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${scoreOrder || 'name ASC'}
     LIMIT 10`,
    params
  );

  return destinations.map(d => ({
    destination_id: d.id,
    name: d.name,
    location: d.location,
    category: d.category,
    estimated_budget: d.estimated_budget ? parseFloat(d.estimated_budget) : null,
    recommended_duration: d.recommended_duration ? parseInt(d.recommended_duration) : null,
    image_url: d.image_url
  }));
}

async function getDestinationDetails(name) {
  const normalized = normalizeText(name);
  const [destinations] = await pool.execute(
    `SELECT id, name, description, location, category, estimated_budget,
            recommended_duration, best_time, activities, image_url
     FROM destinations
     WHERE (LOWER(name) LIKE ? OR LOWER(location) LIKE ?) AND is_active = TRUE
     LIMIT 1`,
    [`%${normalized}%`, `%${normalized}%`]
  );

  if (destinations.length === 0) {
    return null;
  }

  const dest = destinations[0];
  let activities = [];
  if (dest.activities) {
    if (Array.isArray(dest.activities)) {
      activities = dest.activities;
    } else {
      try {
        activities = JSON.parse(dest.activities);
      } catch {
        activities = [String(dest.activities)];
      }
    }
  }

  return {
    id: dest.id,
    name: dest.name,
    description: dest.description,
    location: dest.location,
    category: dest.category,
    estimated_budget: dest.estimated_budget ? parseFloat(dest.estimated_budget) : null,
    recommended_duration: dest.recommended_duration ? parseInt(dest.recommended_duration) : null,
    best_time: dest.best_time,
    activities,
    image_url: dest.image_url
  };
}

async function searchPackages(criteria) {
  const { destinationName, budget } = criteria;
  const params = [];
  const conditions = ['tp.is_active = TRUE'];

  if (destinationName) {
    conditions.push(`(LOWER(d.name) LIKE ? OR LOWER(d.location) LIKE ?)`);
    const normalized = normalizeText(destinationName);
    params.push(`%${normalized}%`, `%${normalized}%`);
  }

  if (budget) {
    conditions.push(`tp.price_per_person <= ?`);
    params.push(budget);
  }

  const [packages] = await pool.execute(
    `SELECT tp.id, tp.name, tp.description, tp.duration_days, tp.price_per_person,
            tp.image_url, tp.max_travelers, d.name as destination_name, d.location as destination_location
     FROM travel_packages tp
     JOIN destinations d ON tp.destination_id = d.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY tp.price_per_person ASC
     LIMIT 10`,
    params
  );

  return packages.map(pkg => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    duration_days: pkg.duration_days ? parseInt(pkg.duration_days) : null,
    price_per_person: pkg.price_per_person ? parseFloat(pkg.price_per_person) : null,
    image_url: pkg.image_url,
    max_travelers: pkg.max_travelers ? parseInt(pkg.max_travelers) : null,
    destination_name: pkg.destination_name,
    destination_location: pkg.destination_location
  }));
}

async function getBudgetRecommendations(budget, duration) {
  let query = `SELECT id, name, location, category, estimated_budget, recommended_duration, image_url
               FROM destinations WHERE is_active = TRUE`;

  const params = [];

  if (budget) {
    query += ' AND estimated_budget <= ?';
    params.push(budget * 1.2);
  }

  if (budget) {
    query += ' ORDER BY ABS(estimated_budget - ?), id DESC LIMIT 10';
    params.push(budget * 0.8);
  } else {
    query += ' ORDER BY estimated_budget ASC LIMIT 10';
  }

  const [destinations] = await pool.execute(query, params);

  return destinations.map(d => ({
    destination_id: d.id,
    name: d.name,
    location: d.location,
    category: d.category,
    estimated_budget: d.estimated_budget ? parseFloat(d.estimated_budget) : null,
    recommended_duration: d.recommended_duration ? parseInt(d.recommended_duration) : null,
    image_url: d.image_url
  }));
}

async function getPersonalizedRecommendations(userId) {
  const result = await recommendationService.getRecommendations(userId, 5);

  if (result.error) {
    return { error: result.error, message: result.message, recommendations: [] };
  }

  return {
    error: null,
    message: 'Personalized recommendations generated successfully',
    recommendations: result.recommendations
  };
}

async function getSavedPreferences(userId) {
  const [prefs] = await pool.execute(
    `SELECT * FROM user_preferences WHERE user_id = ?`,
    [userId]
  );

  if (!prefs[0]) return null;
  const p = prefs[0];
  const parseArr = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; }
  };
  return {
    ...p,
    budget_min: p.budget_min != null ? parseFloat(p.budget_min) : null,
    budget_max: p.budget_max != null ? parseFloat(p.budget_max) : null,
    preferred_travel_types: parseArr(p.preferred_travel_types),
    preferred_destinations: parseArr(p.preferred_destinations),
    preferred_activities: parseArr(p.preferred_activities)
  };
}

async function getUserItineraries(userId) {
  const { data } = await itineraryService.getUserItineraries(userId, 1, 10);
  return data;
}

async function getUserBookings(userId) {
  const [bookings] = await pool.execute(
    `SELECT b.booking_id, b.travel_date, b.travelers, b.total_amount, b.status, b.payment_status,
            tp.name as package_name, d.name as destination_name
     FROM bookings b
     JOIN travel_packages tp ON b.package_id = tp.id
     JOIN destinations d ON b.destination_id = d.id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC
     LIMIT 10`,
    [userId]
  );

  return bookings.map(b => ({
    booking_id: b.booking_id,
    package_name: b.package_name,
    destination_name: b.destination_name,
    travel_date: b.travel_date,
    travelers: b.travelers ? parseInt(b.travelers) : null,
    total_amount: b.total_amount ? parseFloat(b.total_amount) : null,
    status: b.status,
    payment_status: b.payment_status
  }));
}

async function getDestinationReviews(destinationId) {
  const [reviews] = await pool.execute(
    `SELECT r.rating, r.title, r.comment, r.created_at, u.name as user_name
     FROM reviews r
     JOIN users u ON r.user_id = u.id
     WHERE r.destination_id = ?
     ORDER BY r.created_at DESC
     LIMIT 10`,
    [destinationId]
  );

  return reviews.map(r => ({
    rating: r.rating ? parseInt(r.rating) : null,
    title: r.title,
    comment: r.comment,
    created_at: r.created_at,
    user_name: r.user_name
  }));
}

async function getDestinationReviewSummary(destinationId) {
  const [rows] = await pool.execute(
    `SELECT
       COALESCE(AVG(rating), 0) as average_rating,
       COUNT(*) as total_reviews,
       SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1,
       SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2,
       SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3,
       SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4,
       SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5
     FROM reviews
     WHERE destination_id = ?`,
    [destinationId]
  );

  const data = rows[0];
  const total = parseInt(data.total_reviews) || 0;

  return {
    average_rating: total > 0 ? Math.round(parseFloat(data.average_rating) * 10) / 10 : 0,
    total_reviews: total,
    rating_distribution: {
      '1': parseInt(data.count_1) || 0,
      '2': parseInt(data.count_2) || 0,
      '3': parseInt(data.count_3) || 0,
      '4': parseInt(data.count_4) || 0,
      '5': parseInt(data.count_5) || 0
    }
  };
}

async function handleDestinationSearch(text) {
  const location = extractLocation(text);
  const interest = extractInterest(text);
  const budget = extractBudget(text);

  if (!location && !interest && !budget && normalizeText(text).includes('destination')) {
    const searchTerm = text.replace(/destination/i, '').trim();
    const results = await searchDestinations({ search: searchTerm });
    if (results.length > 0) return { intent: 'destination_search', results, isClarificationNeeded: false };
  }

  const results = await searchDestinations({ location, interest, budget });

  if (results.length === 0 && !location) {
    return {
      intent: 'destination_search',
      results: [],
      isClarificationNeeded: true,
      clarification: 'Which location or state are you interested in? For example, "destinations in Karnataka" or "beach destinations".'
    };
  }

  return { intent: 'destination_search', results, isClarificationNeeded: false };
}

async function handleDestinationDetails(text) {
  let destName = extractDestinationName(text);

  if (!destName) {
    const knownNames = ['coorg', 'goa', 'jaipur', 'udaipur', 'kerala', 'manali', 'leh', 'ladakh', 'munnar', 'ooty', 'shimla', 'dharamshala', 'amritsar', 'jodhpur', 'haridwar', 'rishikesh', 'varanasi'];
    const normalized = normalizeText(text);
    for (const name of knownNames) {
      if (normalized.includes(name)) {
        destName = name.charAt(0).toUpperCase() + name.slice(1);
        break;
      }
    }
  }

  if (!destName) {
    return {
      intent: 'destination_details',
      destination: null,
      isClarificationNeeded: true,
      clarification: 'Which destination would you like to know more about? Please tell me the destination name.'
    };
  }

  const destination = await getDestinationDetails(destName);

  if (!destination) {
    return {
      intent: 'destination_details',
      destination: null,
      isClarificationNeeded: false,
      notFoundName: destName
    };
  }

  return { intent: 'destination_details', destination, isClarificationNeeded: false };
}

async function handleBudgetPlanning(text, userId) {
  const budget = extractBudget(text);
  const duration = extractDuration(text);
  const destinationName = null;

  if (!budget) {
    return {
      intent: 'budget_planning',
      results: [],
      isClarificationNeeded: true,
      clarification: 'What is your approximate budget? For example, "destinations within 10000" or "budget under 8000".'
    };
  }

  if (!duration) {
    return {
      intent: 'budget_planning',
      results: [],
      isClarificationNeeded: true,
      clarification: 'How many days do you plan to travel? For example, "for 3 days" or "three-day trip".'
    };
  }

  const results = await getBudgetRecommendations(budget, duration);

  if (results.length === 0) {
    return {
      intent: 'budget_planning',
      results: [],
      isClarificationNeeded: false,
      message: `I couldn't find destinations within your budget of ₹${budget}. Try increasing your budget.`
    };
  }

  return { intent: 'budget_planning', results, budget, duration, isClarificationNeeded: false };
}

async function handleBudgetItinerary(text, userId) {
  const budget = extractBudget(text);
  const duration = extractDuration(text);
  const location = extractLocation(text);

  let results;
  let usedBudget = budget;
  let usedDuration = duration;
  let message = '';

  if (!budget) {
    return {
      intent: 'budget_itinerary',
      result: null,
      isClarificationNeeded: true,
      clarification: 'What is your approximate budget? For example, "within 8000".'
    };
  }

  if (!usedDuration) {
    const prefs = await getSavedPreferences(userId);
    if (prefs && prefs.preferred_duration) {
      usedDuration = prefs.preferred_duration;
      message = `Based on your saved preferences (duration: ${usedDuration} days). `;
    } else {
      return {
        intent: 'budget_itinerary',
        result: null,
        isClarificationNeeded: true,
        clarification: 'How many days do you plan to travel? For example, "for 3 days".'
      };
    }
  }

  let destination;
  if (location) {
    const dests = await searchDestinations({ location });
    if (dests.length > 0) {
      destination = dests[0];
    }
  }

  if (!destination) {
    const budgetDests = await getBudgetRecommendations(usedBudget, usedDuration);
    if (budgetDests.length > 0) {
      destination = budgetDests[0];
    }
  }

  if (!destination) {
    return {
      intent: 'budget_itinerary',
      result: null,
      isClarificationNeeded: false,
      message: message + `I couldn't find a suitable destination within your budget of ₹${usedBudget} for ${usedDuration} days.`
    };
  }

  const itineraryPreview = await itineraryService.generateItinerary({
    userId: userId || null,
    destinationId: destination.destination_id,
    duration: usedDuration,
    budget: usedBudget,
    travelers: 1,
    interests: extractInterest(text) || [],
    travelType: extractTravelType(text) || null
  });

  return {
    intent: 'budget_itinerary',
    destination,
    itinerary: itineraryPreview,
    budget: usedBudget,
    duration: usedDuration,
    message: message + `Here is a ${usedDuration}-day trip to ${destination.name} within your budget of ₹${usedBudget}:`,
    isClarificationNeeded: false
  };
}

async function handleRecommendations(text, userId) {
  if (!userId) {
    return {
      intent: 'recommendations',
      results: [],
      isClarificationNeeded: true,
      clarification: 'For personalized recommendations, please log in first. You can also ask about specific destinations, for example "tell me about Coorg".'
    };
  }

  const result = await getPersonalizedRecommendations(userId);

  if (result.error === 'PREFERENCES_NOT_FOUND') {
    return {
      intent: 'recommendations',
      results: [],
      isClarificationNeeded: true,
      clarification: 'I don\'t have your travel preferences yet. Please save your preferences first to get personalized recommendations. Open Profile → Travel Preferences (profile.html#travel-preferences). You can also ask about destinations by location or interest.'
    };
  }

  if (result.error) {
    return {
      intent: 'recommendations',
      results: [],
      isClarificationNeeded: false,
      message: result.message
    };
  }

  return { intent: 'recommendations', results: result.recommendations, isClarificationNeeded: false };
}

async function handleBookingStatus(userId) {
  if (!userId) {
    return {
      intent: 'booking_status',
      results: [],
      isClarificationNeeded: true,
      clarification: 'Please log in to view your booking history.'
    };
  }

  const bookings = await getUserBookings(userId);
  return { intent: 'booking_status', results: bookings, isClarificationNeeded: false };
}

async function handleReviewSummary(text, userId) {
  let destinationName = extractDestinationName(text);

  if (!destinationName) {
    const knownNames = ['coorg', 'goa', 'jaipur', 'udaipur', 'kerala', 'manali', 'leh', 'ladakh', 'munnar', 'ooty', 'shimla', 'dharamshala', 'amritsar', 'jodhpur', 'haridwar', 'rishikesh', 'varanasi'];
    const normalized = normalizeText(text);
    for (const name of knownNames) {
      if (normalized.includes(name)) {
        destinationName = name.charAt(0).toUpperCase() + name.slice(1);
        break;
      }
    }
  }

  if (!destinationName) {
    return {
      intent: 'review_summary',
      summary: null,
      destination: null,
      isClarificationNeeded: true,
      clarification: 'Which destination would you like to see reviews for? For example, "reviews for Coorg".'
    };
  }

  const destination = await getDestinationDetails(destinationName);

  if (!destination) {
    return {
      intent: 'review_summary',
      summary: null,
      destination: null,
      notFoundName: destinationName,
      isClarificationNeeded: false
    };
  }

  const summary = await getDestinationReviewSummary(destination.id);
  const reviews = await getDestinationReviews(destination.id);

  return { intent: 'review_summary', summary, reviews, destination, isClarificationNeeded: false };
}

function buildIntentReply(intent, result, text) {
  const { isClarificationNeeded, clarification, message, results, destination, budget, duration, notFoundName, summary, itinerary, prefsResult } = result;

  let reply = '';

  if (isClarificationNeeded) {
    return { reply: clarification || 'Could you please provide more details?', suggestions: getSuggestionsForIntent(intent) };
  }

  if (notFoundName) {
    reply = `I couldn't find a destination called "${notFoundName}". Please check the spelling or try another name.`;
    return { reply, suggestions: getSuggestionsForIntent(intent) };
  }

  if (message) {
    reply = message;
  }

  switch (intent) {
    case 'destination_search':
      if (results && results.length > 0) {
        reply = `I found ${results.length} destination${results.length !== 1 ? 's' : ''} matching your search:`;
        results.forEach(r => {
          reply += `\n• ${r.name} (${r.location}) - ${r.category}, Estimated budget: ₹${r.estimated_budget ? r.estimated_budget.toLocaleString() : 'N/A'}, Recommended duration: ${r.recommended_duration || 'N/A'} days`;
        });
      } else {
        reply = message || 'I couldn\'t find destinations matching your criteria. Try a different location or budget.';
      }
      break;

    case 'destination_details':
      if (destination) {
        reply = `${destination.name} in ${destination.location} is a ${destination.category} destination. `;
        reply += `Recommended duration: ${destination.recommended_duration || 'N/A'} days. `;
        reply += `Best time to visit: ${destination.best_time || 'N/A'}. `;
        reply += `Estimated budget: ₹${destination.estimated_budget ? destination.estimated_budget.toLocaleString() : 'N/A'}. `;
        if (destination.activities && destination.activities.length > 0) {
          reply += `Activities: ${destination.activities.join(', ')}.`;
        }
      }
      break;

    case 'budget_planning':
      if (results && results.length > 0) {
        reply = `Here are destinations within your budget of ₹${budget}:`;
        results.forEach(r => {
          reply += `\n• ${r.name} - ₹${r.estimated_budget ? r.estimated_budget.toLocaleString() : 'N/A'} for ${r.recommended_duration || 'N/A'} days`;
        });
      } else {
        reply = message || `I couldn't find destinations within your budget. Try a higher budget.`;
      }
      break;

    case 'budget_itinerary':
      if (result.itinerary && destination) {
        const it = result.itinerary;
        reply = (message || '') + `\n\n${it.destination.name} (${it.duration} days):`;
        reply += `\nTotal estimated cost: ₹${it.total_estimated_cost ? it.total_estimated_cost.toLocaleString() : 'N/A'}`;
        reply += `\nBudget status: ${it.budget_status}`;
        if (it.days && it.days.length > 0) {
          reply += `\n\nDay 1: ${it.days[0].morning_activity || 'Arrival'}`;
        }
        reply += `\n\nYou can create a full itinerary using the AI Planner. Would you like me to help with that?`;
      } else {
        reply = message || 'I couldn\'t plan a trip with those criteria. Try a different budget or duration.';
      }
      break;

    case 'recommendations':
      if (results && results.length > 0) {
        reply = `Based on your preferences, I recommend ${results.length} destination${results.length !== 1 ? 's' : ''}:`;
        results.forEach(r => {
          reply += `\n• ${r.name} (${r.location}) - Match: ${r.match_score}%, ${r.reason}`;
        });
        reply += '\n\nYou can view full recommendations in your dashboard.';
      } else {
        reply = message || 'No recommendations available. Please update your travel preferences.';
      }
      break;

    case 'itinerary_help':
      reply = 'I can help you plan an itinerary! You can use the AI Planner to generate a detailed day-by-day itinerary. What destination and duration are you thinking of?';
      break;

    case 'booking_status':
      if (results && results.length > 0) {
        reply = `You have ${results.length} booking${results.length !== 1 ? 's' : ''}:`;
        results.forEach(b => {
          reply += `\n• ${b.booking_id}: ${b.package_name} (${b.destination_name}) on ${formatDate(b.travel_date)}, ${b.travelers} travelers, Status: ${b.status}, ₹${b.total_amount ? b.total_amount.toLocaleString() : 'N/A'}`;
        });
      } else {
        reply = 'You don\'t have any bookings yet. You can browse packages and book your next trip!';
      }
      break;

    case 'review_summary':
      if (summary) {
        reply = `${destination.name} has an average rating of ${summary.average_rating.toFixed(1)}/5 from ${summary.total_reviews} review${summary.total_reviews !== 1 ? 's' : ''}.`;
      }
      break;

    case 'preferences':
      if (prefsResult) {
        const types = (prefsResult.preferred_travel_types || []).join(', ');
        const dests = (prefsResult.preferred_destinations || []).join(', ');
        const acts = (prefsResult.preferred_activities || []).join(', ');
        const lines = [];
        lines.push(`Budget: ${prefsResult.budget_preference || (prefsResult.budget_min != null || prefsResult.budget_max != null ? `₹${prefsResult.budget_min || 0}–₹${prefsResult.budget_max || 'N/A'}` : 'N/A')}`);
        lines.push(`Duration: ${prefsResult.preferred_trip_duration || (prefsResult.preferred_duration ? prefsResult.preferred_duration + ' days' : 'N/A')}`);
        if (types) lines.push(`Travel types: ${types}`);
        if (dests) lines.push(`Destinations: ${dests}`);
        if (acts) lines.push(`Activities: ${acts}`);
        if (prefsResult.travel_style) lines.push(`Travel style: ${prefsResult.travel_style}`);
        if (prefsResult.accommodation_preference) lines.push(`Accommodation: ${prefsResult.accommodation_preference}`);
        if (prefsResult.preferred_travel_pace) lines.push(`Pace: ${prefsResult.preferred_travel_pace}`);
        reply = `Your saved travel preferences:\n• ${lines.join('\n• ')}\n\nYou can update them in Profile → Travel Preferences (profile.html#travel-preferences).`;
      } else {
        reply = 'You haven\'t saved any travel preferences yet. Open Profile → Travel Preferences (profile.html#travel-preferences) to set them up.';
      }
      break;

    case 'general_travel_help':
      reply = 'Here are some travel tips:\n• Book flights and accommodation at least 2-3 weeks in advance\n• Check the weather before packing\n• Always have travel insurance\n• Keep digital copies of important documents\n• Research local customs and etiquette\n\nWhat specific aspect of travel would you like help with?';
      break;

    case 'package_search':
      if (results && results.length > 0) {
        reply = `I found ${results.length} travel package${results.length !== 1 ? 's' : ''}:`;
        results.forEach(p => {
          reply += `\n• ${p.name} (${p.destination_name}) - ${p.duration_days} days, ₹${p.price_per_person ? p.price_per_person.toLocaleString() : 'N/A'}/person`;
        });
      } else {
        reply = message || 'No packages found matching your criteria.';
      }
      break;

    case 'unknown':
    default:
      reply = message || 'I\'m not sure I understand. I can help you with destinations, packages, recommendations, itineraries, bookings, and reviews. What would you like to know?';
      break;
  }

  const suggestions = getSuggestionsForIntent(intent);
  return { reply, suggestions };
}

function getSuggestionsForIntent(intent) {
  const suggestions = {
    destination_search: [
      'What are the best beach destinations?',
      'Show me hill stations in the budget of 10000',
      'Tell me about Coorg'
    ],
    destination_details: [
      'What activities are available in Goa?',
      'Budget for Jaipur',
      'Best time to visit Manali'
    ],
    budget_planning: [
      'Recommend a trip within 8000 for 3 days',
      'Destinations under 5000',
      'Three-day trip within 10000'
    ],
    budget_itinerary: [
      'Plan a 4-day trip within 12000',
      'Three-day trip within 8000',
      '5-day budget trip under 15000'
    ],
    recommendations: [
      'Recommend destinations for nature lovers',
      'Best places for adventure',
      'Show me my personalized recommendations'
    ],
    itinerary_help: [
      'Plan a 3-day trip to Coorg',
      'Help me plan a 5-day itinerary',
      'Generate itinerary for Jaipur'
    ],
    booking_status: [
      'Show me my bookings',
      'My booking status',
      'Booking history'
    ],
    review_summary: [
      'What is the rating for Coorg?',
      'Reviews for Goa',
      'Show me reviews for Jaipur'
    ],
    preferences: [
      'My travel preferences',
      'My saved budget',
      'Update my preferences'
    ],
    general_travel_help: [
      'Travel tips for first-time visitors',
      'What to pack for a hill station',
      'How to plan a budget trip'
    ],
    package_search: [
      'Show me travel packages',
      'Affordable packages',
      'Packages for 2 people'
    ],
    unknown: [
      'Recommend a trip within 10000 rs',
      'What are the best destinations for nature lovers?',
      'Show available travel packages',
      'Help me plan a three-day itinerary',
      'How can I check my bookings?'
    ]
  };

  return suggestions[intent] || suggestions.unknown;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function processMessage(message, sessionId, userId) {
  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  const session = getOrCreateSession(sessionId, userId);

  addMessage(session, 'user', message);

  const intent = classifyIntent(message);

  let result;
  let error = null;

  try {
    switch (intent) {
      case 'destination_search':
        result = await handleDestinationSearch(message);
        break;

      case 'destination_details':
        result = await handleDestinationDetails(message);
        break;

      case 'package_search': {
        const packages = await searchPackages({ budget: extractBudget(message) });
        result = { intent: 'package_search', results: packages, isClarificationNeeded: false };
        break;
      }

      case 'budget_planning':
        result = await handleBudgetPlanning(message, userId);
        break;

      case 'budget_itinerary':
        result = await handleBudgetItinerary(message, userId);
        break;

      case 'recommendations':
        result = await handleRecommendations(message, userId);
        break;

      case 'itinerary_help': {
        const location = extractLocation(message);
        const duration = extractDuration(message);
        const budget = extractBudget(message);

        if (location || duration || budget) {
          result = await handleBudgetItinerary(message, userId);
        } else {
          result = {
            intent: 'itinerary_help',
            isClarificationNeeded: true,
            clarification: 'To plan an itinerary, tell me the destination, duration, and budget. For example, "plan a 3-day trip to Coorg within 8000".'
          };
        }
        break;
      }

      case 'booking_status':
        result = await handleBookingStatus(userId);
        break;

      case 'review_summary':
        result = await handleReviewSummary(message, userId);
        break;

      case 'preferences':
        if (!userId) {
          result = {
            intent: 'preferences',
            isClarificationNeeded: true,
            clarification: 'Please log in to view your saved preferences.'
          };
        } else {
          const prefs = await getSavedPreferences(userId);
          result = { intent: 'preferences', prefsResult: prefs, isClarificationNeeded: false };
        }
        break;

      case 'general_travel_help':
        result = { intent: 'general_travel_help', isClarificationNeeded: false };
        break;

      case 'unknown':
      default:
        result = { intent: 'unknown', isClarificationNeeded: true, clarification: 'I\'m not sure I understand. I can help you with destinations, packages, recommendations, itineraries, bookings, and reviews. What would you like to know?' };
        break;
    }
  } catch (err) {
    console.error('Chatbot service error:', err);
    error = err.message || 'An error occurred while processing your request';
    result = { intent: 'error', isClarificationNeeded: false, message: 'I\'m having trouble processing your request. Please try again.' };
  }

  let replyData;
  if (error) {
    replyData = {
      reply: result.message,
      suggestions: getSuggestionsForIntent('unknown'),
      intent: result.intent || 'error'
    };
  } else {
    replyData = buildIntentReply(intent, result, message);
    replyData.intent = intent;
  }

  addMessage(session, 'assistant', replyData.reply || '', { intent, error });

  return {
    session_id: session.id,
    intent: replyData.intent,
    reply: replyData.reply,
    suggestions: replyData.suggestions,
    data: {
      results: result.results || null,
      destination: result.destination || null,
      summary: result.summary || null,
      itinerary: result.itinerary || null,
      budget: result.budget || null,
      duration: result.duration || null,
      message: result.message || null
    }
  };
}

function clearSession(sessionId, userId) {
  const session = getSession(sessionId, userId);
  if (session) {
    sessionStore.delete(sessionId);
    return true;
  }
  return false;
}

function getSessionHistory(sessionId, userId) {
  const session = getSession(sessionId, userId);
  if (!session) {
    return null;
  }
  return session.messages;
}

module.exports = {
  processMessage,
  getSession,
  getSessionHistory,
  clearSession,
  sessionStore,
  classifyIntent,
  extractBudget,
  extractDuration,
  extractLocation,
  extractInterest,
  extractTravelType,
  createSession,
  getOrCreateSession
};
