const BUDGET_DEFAULTS = {
  TRANSPORT_PER_DAY_PER_PERSON: 800,
  ACCOMMODATION_PER_NIGHT_PER_PERSON: 2000,
  FOOD_PER_DAY_PER_PERSON: 800,
  ACTIVITIES_PER_DAY_PER_PERSON: 500,
  MISC_PER_DAY_PER_PERSON: 300,
  MIN_TOTAL_BUDGET: 1000
};

const CATEGORY_MULTIPLIERS = {
  'Hill Station': { transport: 1.2, accommodation: 1.1, food: 1.0, activities: 1.1 },
  'Beach': { transport: 1.0, accommodation: 1.3, food: 1.1, activities: 1.0 },
  'Heritage': { transport: 0.9, accommodation: 1.0, food: 0.9, activities: 1.2 },
  'Adventure': { transport: 1.3, accommodation: 1.0, food: 1.0, activities: 1.4 },
  'Backwaters': { transport: 1.1, accommodation: 1.2, food: 1.0, activities: 0.9 },
  'Wildlife': { transport: 1.4, accommodation: 1.1, food: 1.0, activities: 1.3 },
  'Desert': { transport: 1.2, accommodation: 1.0, food: 0.9, activities: 1.1 },
  'Spiritual': { transport: 0.8, accommodation: 0.8, food: 0.8, activities: 0.7 },
  default: { transport: 1.0, accommodation: 1.0, food: 1.0, activities: 1.0 }
};

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function getCategoryMultipliers(category) {
  return CATEGORY_MULTIPLIERS[category] || CATEGORY_MULTIPLIERS.default;
}

function calculateBaseCosts(duration, travelers) {
  return {
    transportation: BUDGET_DEFAULTS.TRANSPORT_PER_DAY_PER_PERSON * duration * travelers,
    accommodation: BUDGET_DEFAULTS.ACCOMMODATION_PER_NIGHT_PER_PERSON * Math.max(0, duration - 1) * travelers,
    food: BUDGET_DEFAULTS.FOOD_PER_DAY_PER_PERSON * duration * travelers,
    activities: BUDGET_DEFAULTS.ACTIVITIES_PER_DAY_PER_PERSON * duration * travelers,
    miscellaneous: BUDGET_DEFAULTS.MISC_PER_DAY_PER_PERSON * duration * travelers
  };
}

function applyCategoryMultipliers(baseCosts, category) {
  const multipliers = getCategoryMultipliers(category);
  return {
    transportation: roundToTwoDecimals(baseCosts.transportation * multipliers.transport),
    accommodation: roundToTwoDecimals(baseCosts.accommodation * multipliers.accommodation),
    food: roundToTwoDecimals(baseCosts.food * multipliers.food),
    activities: roundToTwoDecimals(baseCosts.activities * multipliers.activities),
    miscellaneous: roundToTwoDecimals(baseCosts.miscellaneous)
  };
}

function applyDestinationBudgetAdjustment(costs, destinationEstimatedBudget, duration, travelers) {
  if (!destinationEstimatedBudget || destinationEstimatedBudget <= 0) {
    return costs;
  }

  const perPersonPerDay = destinationEstimatedBudget / (duration * travelers);
  const currentPerPersonPerDay = Object.values(costs).reduce((sum, val) => sum + val, 0) / (duration * travelers);

  if (currentPerPersonPerDay === 0) return costs;

  const adjustmentFactor = Math.min(Math.max(perPersonPerDay / currentPerPersonPerDay, 0.5), 2.0);

  return {
    transportation: roundToTwoDecimals(costs.transportation * adjustmentFactor),
    accommodation: roundToTwoDecimals(costs.accommodation * adjustmentFactor),
    food: roundToTwoDecimals(costs.food * adjustmentFactor),
    activities: roundToTwoDecimals(costs.activities * adjustmentFactor),
    miscellaneous: roundToTwoDecimals(costs.miscellaneous * adjustmentFactor)
  };
}

function calculateBudgetBreakdown(params) {
  const {
    destination,
    duration,
    travelers,
    userBudget,
    destinationEstimatedBudget
  } = params;

  const category = destination?.category || 'default';
  
  let costs = calculateBaseCosts(duration, travelers);
  costs = applyCategoryMultipliers(costs, category);
  costs = applyDestinationBudgetAdjustment(costs, destinationEstimatedBudget, duration, travelers);

  const totalEstimatedCost = roundToTwoDecimals(
    Object.values(costs).reduce((sum, val) => sum + val, 0)
  );

  let budgetStatus = 'within_budget';
  let budgetDifference = 0;
  let suggestions = [];

  if (userBudget && userBudget > 0) {
    budgetDifference = roundToTwoDecimals(userBudget - totalEstimatedCost);
    if (budgetDifference < 0) {
      budgetStatus = 'over_budget';
      suggestions = generateCostSavingSuggestions(costs, Math.abs(budgetDifference), travelers, duration);
    } else if (budgetDifference < userBudget * 0.1) {
      budgetStatus = 'near_budget';
    }
  }

  return {
    breakdown: costs,
    total_estimated_cost: totalEstimatedCost,
    budget_status: budgetStatus,
    budget_difference: budgetDifference,
    suggestions,
    assumptions: getAssumptions(duration, travelers, category)
  };
}

function generateCostSavingSuggestions(costs, overAmount, travelers, duration) {
  const suggestions = [];
  const total = Object.values(costs).reduce((sum, val) => sum + val, 0);

  const sortedCosts = Object.entries(costs).sort((a, b) => b[1] - a[1]);

  for (const [category, amount] of sortedCosts) {
    if (overAmount <= 0) break;
    
    const reduction = Math.min(amount * 0.3, overAmount);
    if (reduction > 100) {
      const percentage = Math.round((reduction / amount) * 100);
      suggestions.push({
        category: formatCategoryName(category),
        suggestion: `Reduce ${formatCategoryName(category).toLowerCase()} costs by ~${percentage}% (save ₹${roundToTwoDecimals(reduction)})`,
        potential_savings: roundToTwoDecimals(reduction)
      });
      overAmount -= reduction;
    }
  }

  if (suggestions.length === 0 && overAmount > 0) {
    suggestions.push({
      category: 'General',
      suggestion: `Consider reducing trip duration by 1 day or traveling with fewer people`,
      potential_savings: roundToTwoDecimals(Math.min(overAmount, total * 0.2))
    });
  }

  return suggestions;
}

function formatCategoryName(category) {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');
}

function getAssumptions(duration, travelers, category) {
  return [
    `Transport: ₹${BUDGET_DEFAULTS.TRANSPORT_PER_DAY_PER_PERSON}/day/person (local transport, inter-city travel)`,
    `Accommodation: ₹${BUDGET_DEFAULTS.ACCOMMODATION_PER_NIGHT_PER_PERSON}/night/person (mid-range hotels/homestays, ${duration > 1 ? duration - 1 : 0} nights)`,
    `Food: ₹${BUDGET_DEFAULTS.FOOD_PER_DAY_PER_PERSON}/day/person (breakfast, lunch, dinner, snacks)`,
    `Activities: ₹${BUDGET_DEFAULTS.ACTIVITIES_PER_DAY_PER_PERSON}/day/person (entry fees, guides, tours)`,
    `Miscellaneous: ₹${BUDGET_DEFAULTS.MISC_PER_DAY_PER_PERSON}/day/person (shopping, tips, emergencies)`,
    `Category adjustment applied for "${category}" destinations`,
    `All costs are estimates in INR and may vary based on season, booking time, and personal preferences`
  ];
}

function calculateItineraryDayCosts(days, baseCosts, destinationEstimatedBudget, duration, travelers) {
  if (!days || days.length === 0) return [];

  const totalActivities = days.reduce((sum, day) => {
    const activities = [day.morning_activity, day.afternoon_activity, day.evening_activity].filter(Boolean);
    return sum + activities.length;
  }, 0);

  const avgActivitiesPerDay = totalActivities / days.length;
  const activityCostPerItem = (baseCosts.activities / duration) / Math.max(avgActivitiesPerDay, 1);

  return days.map((day, index) => {
    const activities = [day.morning_activity, day.afternoon_activity, day.evening_activity].filter(Boolean);
    const dayActivityCost = roundToTwoDecimals(activities.length * activityCostPerItem);
    
    const dailyTransport = roundToTwoDecimals(baseCosts.transportation / duration);
    const dailyFood = roundToTwoDecimals(baseCosts.food / duration);
    const dailyAccommodation = index < duration - 1 ? roundToTwoDecimals(baseCosts.accommodation / (duration - 1)) : 0;
    const dailyMisc = roundToTwoDecimals(baseCosts.miscellaneous / duration);

    return {
      day_number: day.day_number,
      estimated_cost: roundToTwoDecimals(dailyTransport + dailyAccommodation + dailyFood + dayActivityCost + dailyMisc),
      cost_breakdown: {
        transportation: dailyTransport,
        accommodation: dailyAccommodation,
        food: dailyFood,
        activities: dayActivityCost,
        miscellaneous: dailyMisc
      }
    };
  });
}

module.exports = {
  calculateBudgetBreakdown,
  calculateItineraryDayCosts,
  BUDGET_DEFAULTS,
  CATEGORY_MULTIPLIERS,
  getAssumptions
};