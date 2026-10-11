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

  if (scores.interestScore > 70) {
    const highInterests = [];
    PREFERENCE_SCORE_FIELDS.forEach((field, idx) => {
      const userVal = userPrefs[field] || 0;
      const destVal = destination[DESTINATION_SCORE_FIELDS[idx]] || 0;
      if (userVal >= 60 && destVal >= 60) {
        const name = field.replace('_interest', '').replace('_score', '');
        highInterests.push(name.charAt(0).toUpperCase() + name.slice(1));
      }
    });
    if (highInterests.length > 0) {
      reasons.push(`Excellent match for your interest in ${highInterests.join(', ').toLowerCase()}`);
    }
  } else if (scores.interestScore > 40) {
    const matchInterests = [];
    PREFERENCE_SCORE_FIELDS.forEach((field, idx) => {
      const userVal = userPrefs[field] || 0;
      const destVal = destination[DESTINATION_SCORE_FIELDS[idx]] || 0;
      if (userVal >= 40 && destVal >= 40) {
        const name = field.replace('_interest', '');
        matchInterests.push(name.charAt(0).toUpperCase() + name.slice(1));
      }
    });
    if (matchInterests.length > 0) {
      reasons.push(`Good match for your interest in ${matchInterests.join(', ').toLowerCase()}`);
    }
  }

  if (scores.budgetScore >= 80) {
    reasons.push('Estimated budget fits well within your range');
  } else if (scores.budgetScore >= 50) {
    reasons.push('Estimated budget is close to your range');
  } else if (destination.estimated_budget && userPrefs.budget_max && destination.estimated_budget > userPrefs.budget_max) {
    reasons.push(`Note: Estimated budget (₹${destination.estimated_budget.toLocaleString()}) exceeds your maximum (₹${userPrefs.budget_max.toLocaleString()})`);
  }

  if (scores.durationScore >= 80) {
    reasons.push('Recommended duration matches your available time');
  } else if (scores.durationScore >= 50) {
    reasons.push('Duration is reasonably close to your preference');
  }

  if (scores.categoryScore >= 80) {
    reasons.push(`${destination.category} destination aligns with your travel style`);
  }

  if (reasons.length === 0) {
    reasons.push('This destination matches some of your preferences');
  }

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
    preferred_duration: parseInt(p.preferred_duration)
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

function calculateRecommendations(userPrefs, destinations) {
  if (!userPrefs || destinations.length === 0) {
    return [];
  }

  const userVector = PREFERENCE_SCORE_FIELDS.map(field => userPrefs[field] || 0);
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

    const weights = {
      interest: 0.50,
      budget: 0.20,
      duration: 0.15,
      category: 0.15
    };

    const matchScore = Math.round(
      interestScore * weights.interest +
      budgetScore * weights.budget +
      durationScore * weights.duration +
      categoryScore * weights.category
    );

    const clampedScore = Math.min(100, Math.max(0, matchScore));

    const scores = {
      interestScore: Math.round(interestScore),
      budgetScore: Math.round(budgetScore),
      durationScore: Math.round(durationScore),
      categoryScore: Math.round(categoryScore)
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