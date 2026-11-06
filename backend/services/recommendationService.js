const { pool } = require('../config/database');

const DESTINATION_SCORE_FIELDS = [
  'nature_score',
  'adventure_score',
  'beach_score',
  'history_score',
  'culture_score',
  'food_score',
  'photography_score',
  'shopping_score'
];

const PREFERENCE_SCORE_FIELDS = [
  'nature_interest',
  'adventure_interest',
  'beach_interest',
  'history_interest',
  'culture_interest',
  'food_interest',
  'photography_interest',
  'shopping_interest'
];

const VALID_TRAVEL_TYPES = ['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury'];

const CATEGORY_TRAVEL_TYPE_MAP = {
  'Hill Station': ['nature', 'adventure', 'relaxation', 'honeymoon'],
  'Beach': ['beach', 'relaxation', 'honeymoon', 'family'],
  'Heritage': ['heritage', 'culture', 'spiritual'],
  'Adventure': ['adventure', 'wildlife'],
  'Backwaters': ['relaxation', 'nature', 'honeymoon'],
  'Wildlife': ['wildlife', 'adventure', 'nature'],
  'Desert': ['adventure', 'culture'],
  'Spiritual': ['spiritual', 'heritage']
};

function cosineSimilarity(userVector, destVector) {
  let dotProduct = 0;
  let userMagnitude = 0;
  let destMagnitude = 0;

  for (let i = 0; i < userVector.length; i++) {
    dotProduct += userVector[i] * destVector[i];
    userMagnitude += userVector[i] * userVector[i];
    destMagnitude += destVector[i] * destVector[i];
  }

  userMagnitude = Math.sqrt(userMagnitude);
  destMagnitude = Math.sqrt(destMagnitude);

  if (userMagnitude === 0 || destMagnitude === 0) {
    return 0;
  }

  return dotProduct / (userMagnitude * destMagnitude);
}

function calculateBudgetMatch(userBudgetMin, userBudgetMax, destBudget) {
  if (destBudget === null || destBudget === undefined) {
    return 50;
  }

  if (userBudgetMin !== null && userBudgetMax !== null) {
    const midBudget = (userBudgetMin + userBudgetMax) / 2;
    const diff = Math.abs(destBudget - midBudget);
    const range = userBudgetMax - userBudgetMin;
    if (range === 0) {
      return destBudget <= userBudgetMax ? 100 : Math.max(0, 100 - (diff / userBudgetMax) * 100);
    }
    const score = Math.max(0, 100 - (diff / range) * 100);
    return destBudget <= userBudgetMax ? score : Math.max(0, score - 20);
  }

  if (userBudgetMax !== null) {
    if (destBudget <= userBudgetMax) return 100;
    const overBudget = (destBudget - userBudgetMax) / userBudgetMax;
    return Math.max(0, 100 - overBudget * 100);
  }

  return 50;
}

function calculateDurationMatch(userDuration, destDuration) {
  if (userDuration === null || userDuration === undefined || destDuration === null || destDuration === undefined) {
    return 50;
  }

  const diff = Math.abs(userDuration - destDuration);
  if (diff === 0) return 100;
  if (diff <= 1) return 80;
  if (diff <= 2) return 60;
  if (diff <= 3) return 40;
  return 20;
}

function calculateCategoryMatch(userTravelType, destCategory) {
  if (!userTravelType || !destCategory) return 50;

  const matchingTypes = CATEGORY_TRAVEL_TYPE_MAP[destCategory] || [];
  const normalizedUserType = userTravelType.toLowerCase();

  if (matchingTypes.includes(normalizedUserType)) {
    return 100;
  }

  if (matchingTypes.length > 0) {
    return 30;
  }

  return 50;
}

function generateReason(userPrefs, destination, scores) {
  const reasons = [];
  const wantedDests = parseJsonArray(userPrefs.preferred_destinations).filter(x => x !== 'Other');
  if (wantedDests.length && scores.destinationPrefScore >= 100) {
    reasons.push(`Matches your preferred destination area (${wantedDests.join(', ')})`);
  }
  const wantedTypes = parseJsonArray(userPrefs.preferred_travel_types);
  if (wantedTypes.length && (scores.interestScore > 55 || scores.categoryScore >= 80)) {
    reasons.push(`Fits your travel interests (${wantedTypes.slice(0, 3).join(', ')})`);
  }
  const wantedActs = parseJsonArray(userPrefs.preferred_activities);
  if (wantedActs.length && scores.interestScore > 55) {
    reasons.push(`Supports activities you prefer (${wantedActs.slice(0, 3).join(', ')})`);
  }
  if (userPrefs.budget_preference && scores.budgetScore >= 70) {
    reasons.push(`Works with your ${userPrefs.budget_preference} budget preference`);
  } else if (scores.budgetScore >= 80) {
    reasons.push('Estimated budget fits well within your range');
  } else if (scores.budgetScore >= 50) {
    reasons.push('Estimated budget is close to your range');
  }
  if (userPrefs.travel_style && scores.styleScore >= 80) {
    reasons.push(`Good fit for ${userPrefs.travel_style} travel`);
  }
  if (scores.durationScore >= 80) reasons.push('Recommended duration matches your available time');
  if (reasons.length === 0) reasons.push('This destination matches some of your preferences');
  return reasons.join('. ') + '.';
}

async function getUserPreferences(userId) {
  const [prefs] = await pool.execute(
    `SELECT * FROM user_preferences WHERE user_id = ?`,
    [userId]
  );
  if (!prefs[0]) return null;
  
  // Convert MySQL DECIMAL strings to numbers
  const p = prefs[0];
  return {
    ...p,
    budget_min: p.budget_min ? parseFloat(p.budget_min) : null,
    budget_max: p.budget_max ? parseFloat(p.budget_max) : null,
    nature_interest: parseInt(p.nature_interest),
    adventure_interest: parseInt(p.adventure_interest),
    beach_interest: parseInt(p.beach_interest),
    history_interest: parseInt(p.history_interest),
    culture_interest: parseInt(p.culture_interest),
    food_interest: parseInt(p.food_interest),
    photography_interest: parseInt(p.photography_interest),
    shopping_interest: parseInt(p.shopping_interest),
    preferred_duration: p.preferred_duration != null ? parseInt(p.preferred_duration) : null,
    preferred_travel_types: parseJsonArray(p.preferred_travel_types),
    preferred_destinations: parseJsonArray(p.preferred_destinations),
    preferred_activities: parseJsonArray(p.preferred_activities)
  };
}

async function getActiveDestinations() {
  const [destinations] = await pool.execute(
    `SELECT id, name, location, category, estimated_budget, recommended_duration,
            image_url, nature_score, adventure_score, beach_score, history_score,
            culture_score, food_score, photography_score, shopping_score
     FROM destinations WHERE is_active = TRUE`
  );
  
  // Convert MySQL DECIMAL strings to numbers
  return destinations.map(d => ({
    ...d,
    estimated_budget: d.estimated_budget ? parseFloat(d.estimated_budget) : null,
    recommended_duration: parseInt(d.recommended_duration),
    nature_score: parseInt(d.nature_score),
    adventure_score: parseInt(d.adventure_score),
    beach_score: parseInt(d.beach_score),
    history_score: parseInt(d.history_score),
    culture_score: parseInt(d.culture_score),
    food_score: parseInt(d.food_score),
    photography_score: parseInt(d.photography_score),
    shopping_score: parseInt(d.shopping_score)
  }));
}

function parseJsonArray(val) {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) return val;
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

function interestVectorFromProfile(prefs) {
  const types = new Set(parseJsonArray(prefs.preferred_travel_types).map(s => String(s).toLowerCase()));
  const acts = new Set(parseJsonArray(prefs.preferred_activities).map(s => String(s).toLowerCase()));
  const base = PREFERENCE_SCORE_FIELDS.map(field => prefs[field] || 0);
  const boost = (i, cond) => { if (cond) base[i] = Math.max(base[i], 80); };
  boost(0, types.has('nature') || types.has('hill stations') || acts.has('trekking') || acts.has('camping')); // nature
  boost(1, types.has('adventure') || acts.has('trekking') || acts.has('camping') || acts.has('wildlife safari')); // adventure
  boost(2, types.has('beach') || acts.has('boating')); // beach
  boost(3, types.has('historical places') || types.has('religious tourism') || acts.has('sightseeing')); // history
  boost(4, types.has('cultural tourism') || types.has('religious tourism') || acts.has('food exploration')); // culture
  boost(5, acts.has('food exploration')); // food
  boost(6, acts.has('photography')); // photography
  boost(7, acts.has('shopping')); // shopping
  return base;
}

function calculateDestinationPreferenceMatch(prefs, dest) {
  const wanted = parseJsonArray(prefs.preferred_destinations);
  if (!wanted.length) return 50;
  const hay = `${dest.name || ''} ${dest.location || ''} ${dest.category || ''}`.toLowerCase();
  for (const w of wanted) {
    if (w === 'Other') continue;
    if (hay.includes(w.toLowerCase())) return 100;
  }
  if (wanted.includes('Other')) return 45;
  return 25;
}

function calculateStyleMatch(prefs, dest) {
  const style = (prefs.travel_style || '').toLowerCase();
  if (!style) return 50;
  const cat = (dest.category || '').toLowerCase();
  if (style === 'family' && (cat.includes('beach') || cat.includes('heritage') || cat.includes('hill'))) return 85;
  if ((style === 'couple' || style === 'honeymoon') && (cat.includes('beach') || cat.includes('hill') || cat.includes('backwater'))) return 85;
  if ((style === 'friends' || style === 'group') && (cat.includes('adventure') || cat.includes('beach'))) return 80;
  if (style === 'solo' && (cat.includes('adventure') || cat.includes('heritage') || cat.includes('spiritual'))) return 80;
  return 50;
}

function calculateRecommendations(userPrefs, destinations) {
  if (!userPrefs || destinations.length === 0) {
    return [];
  }

  const userVector = interestVectorFromProfile(userPrefs);
  const userHasAnyInterest = userVector.some(v => v > 0);

  return destinations.map(dest => {
    const destVector = DESTINATION_SCORE_FIELDS.map(field => dest[field] || 0);

    let interestScore = 0;
    if (userHasAnyInterest) {
      interestScore = cosineSimilarity(userVector, destVector) * 100;
    } else {
      interestScore = 50;
    }

    const budgetScore = calculateBudgetMatch(userPrefs.budget_min, userPrefs.budget_max, dest.estimated_budget);
    const durationScore = calculateDurationMatch(userPrefs.preferred_duration, dest.recommended_duration);
    const categoryScore = calculateCategoryMatch(userPrefs.travel_type, dest.category);
    const destinationPrefScore = calculateDestinationPreferenceMatch(userPrefs, dest);
    const styleScore = calculateStyleMatch(userPrefs, dest);

    const weights = {
      interest: 0.35,
      budget: 0.20,
      duration: 0.10,
      category: 0.10,
      destinationPref: 0.15,
      style: 0.10
    };

    const matchScore = Math.round(
      interestScore * weights.interest +
      budgetScore * weights.budget +
      durationScore * weights.duration +
      categoryScore * weights.category +
      destinationPrefScore * weights.destinationPref +
      styleScore * weights.style
    );

    const clampedScore = Math.min(100, Math.max(0, matchScore));

    const scores = {
      interestScore: Math.round(interestScore),
      budgetScore: Math.round(budgetScore),
      durationScore: Math.round(durationScore),
      categoryScore: Math.round(categoryScore),
      destinationPrefScore: Math.round(destinationPrefScore),
      styleScore: Math.round(styleScore)
    };

    const reason = generateReason(userPrefs, dest, scores);

    return {
      destination_id: dest.id,
      name: dest.name,
      location: dest.location,
      category: dest.category,
      estimated_budget: dest.estimated_budget,
      recommended_duration: dest.recommended_duration,
      image_url: dest.image_url,
      match_score: clampedScore,
      reason,
      score_breakdown: scores
    };
  }).sort((a, b) => b.match_score - a.match_score);
}

async function saveRecommendations(userId, recommendations) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM recommendations WHERE user_id = ?', [userId]);

    for (const rec of recommendations) {
      await connection.execute(
        `INSERT INTO recommendations (user_id, destination_id, match_percentage, reason)
         VALUES (?, ?, ?, ?)`,
        [userId, rec.destination_id, rec.match_score, rec.reason]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRecommendations(userId, limit = 5) {
  const userPrefs = await getUserPreferences(userId);

  if (!userPrefs) {
    return {
      error: 'PREFERENCES_NOT_FOUND',
      message: 'Please save your travel preferences first to get personalized recommendations.'
    };
  }

  const destinations = await getActiveDestinations();

  if (destinations.length === 0) {
    return {
      error: 'NO_DESTINATIONS',
      message: 'No destinations available at the moment.'
    };
  }

  const allRecommendations = calculateRecommendations(userPrefs, destinations);
  const topRecommendations = allRecommendations.slice(0, Math.min(limit, 20));

  await saveRecommendations(userId, topRecommendations);

  return {
    recommendations: topRecommendations.map(({ score_breakdown, ...rec }) => rec)
  };
}

module.exports = {
  getRecommendations,
  calculateRecommendations,
  cosineSimilarity,
  calculateBudgetMatch,
  calculateDurationMatch,
  calculateCategoryMatch,
  generateReason,
  DESTINATION_SCORE_FIELDS,
  PREFERENCE_SCORE_FIELDS,
  VALID_TRAVEL_TYPES,
  CATEGORY_TRAVEL_TYPE_MAP
};