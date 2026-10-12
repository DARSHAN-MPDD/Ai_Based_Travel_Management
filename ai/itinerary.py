#!/usr/bin/env python3
"""
TravelMind AI - Intelligent Itinerary Generator
Uses destination attributes and user preferences to generate personalized travel itineraries.
"""

import json
import sys
import os
from typing import Dict, List, Any, Optional

VALID_INTERESTS = ['nature', 'adventure', 'beach', 'history', 'culture', 'food', 'photography', 'shopping']
VALID_TRAVEL_TYPES = ['nature', 'adventure', 'beach', 'heritage', 'culture', 'spiritual', 'wildlife', 'relaxation', 'family', 'honeymoon', 'budget', 'luxury']
VALID_PACES = ['relaxed', 'balanced', 'packed']

ACTIVITY_TEMPLATES = {
    'nature': {
        'morning': ['Nature walk and bird watching', 'Sunrise viewpoint visit', 'Forest trail exploration', 'Botanical garden tour'],
        'afternoon': ['Wildlife sanctuary visit', 'Nature photography session', 'Waterfall visit', 'Lake boating', 'Eco-park exploration'],
        'evening': ['Sunset at viewpoint', 'Campfire and stargazing', 'Nature documentary screening', 'Guided night walk']
    },
    'adventure': {
        'morning': ['Trekking to peak', 'Rock climbing session', 'River rafting', 'Zip lining adventure', 'Mountain biking'],
        'afternoon': ['Adventure park activities', 'Paragliding', 'Canyoning', 'ATV off-road ride', 'Bungee jumping'],
        'evening': ['Campfire with adventure stories', 'Night trek', 'Adventure gear showcase', 'Relax at base camp']
    },
    'beach': {
        'morning': ['Beach sunrise walk', 'Swimming and sunbathing', 'Beach volleyball', 'Snorkeling', 'Kayaking'],
        'afternoon': ['Beach hopping tour', 'Scuba diving', 'Jet skiing', 'Beachside lunch', 'Sandcastle building'],
        'evening': ['Sunset beach dinner', 'Bonfire on beach', 'Night beach walk', 'Beach party']
    },
    'history': {
        'morning': ['Historic fort/palace guided tour', 'Archaeological site visit', 'Heritage museum tour', 'Ancient temple exploration'],
        'afternoon': ['Historical walking tour', 'Monument photography', 'Heritage craft workshop', 'Cultural heritage center visit'],
        'evening': ['Sound and light show', 'Historic district evening walk', 'Traditional cultural performance', 'Heritage hotel stay']
    },
    'culture': {
        'morning': ['Local village cultural tour', 'Traditional craft workshop', 'Cooking class with locals', 'Temple/religious site visit'],
        'afternoon': ['Art gallery and museum visit', 'Cultural festival participation', 'Music and dance workshop', 'Local market exploration'],
        'evening': ['Cultural dinner with local family', 'Folk music and dance performance', 'Traditional storytelling', 'Night market visit']
    },
    'food': {
        'morning': ['Local breakfast tasting tour', 'Market visit for fresh ingredients', 'Cooking class', 'Food history walking tour'],
        'afternoon': ['Restaurant hopping lunch', 'Street food tour', 'Winery/brewery visit', 'Farm to table experience'],
        'evening': ['Fine dining experience', 'Food festival visit', 'Night market food crawl', 'Cooking demonstration dinner']
    },
    'photography': {
        'morning': ['Golden hour landscape photography', 'Architecture photography walk', 'Wildlife photography safari', 'Street photography session'],
        'afternoon': ['Portrait photography with locals', 'Macro photography workshop', 'Drone photography session', 'Long exposure practice'],
        'evening': ['Blue hour cityscape photography', 'Astrophotography session', 'Light painting workshop', 'Photo review and editing']
    },
    'shopping': {
        'morning': ['Local artisan market visit', 'Handicraft workshop tour', 'Textile factory visit', 'Antique shop browsing'],
        'afternoon': ['Designer boutique shopping', 'Souvenir hunting', 'Jewelry making workshop', 'Spice market exploration'],
        'evening': ['Night market shopping', 'Duty free shopping', 'Local mall visit', 'Shopping street walk']
    }
}

DEFAULT_ACTIVITIES = {
    'morning': ['Explore local attractions', 'Visit main landmark', 'Guided city tour'],
    'afternoon': ['Lunch at local restaurant', 'Free time for exploration', 'Visit museum or gallery'],
    'evening': ['Dinner at recommended restaurant', 'Evening walk', 'Relax at accommodation']
}

PACE_CONFIG = {
    'relaxed': {
        'activities_per_slot': 1,
        'max_activities_per_day': 3,
        'description': 'Light schedule with plenty of free time'
    },
    'balanced': {
        'activities_per_slot': 2,
        'max_activities_per_day': 6,
        'description': 'Moderate schedule with balanced activities and rest'
    },
    'packed': {
        'activities_per_slot': 3,
        'max_activities_per_day': 9,
        'description': 'Full schedule maximizing experiences'
    }
}

DESTINATION_INTEREST_SCORES = {
    'Hill Station': {'nature': 90, 'adventure': 70, 'beach': 10, 'history': 40, 'culture': 60, 'food': 70, 'photography': 85, 'shopping': 50},
    'Beach': {'nature': 60, 'adventure': 50, 'beach': 95, 'history': 60, 'culture': 55, 'food': 70, 'photography': 80, 'shopping': 40},
    'Heritage': {'nature': 30, 'adventure': 40, 'beach': 10, 'history': 95, 'culture': 90, 'food': 80, 'photography': 75, 'shopping': 85},
    'Adventure': {'nature': 80, 'adventure': 95, 'beach': 10, 'history': 40, 'culture': 55, 'food': 65, 'photography': 80, 'shopping': 50},
    'Backwaters': {'nature': 85, 'adventure': 30, 'beach': 60, 'history': 50, 'culture': 75, 'food': 80, 'photography': 80, 'shopping': 45},
    'Wildlife': {'nature': 95, 'adventure': 85, 'beach': 5, 'history': 30, 'culture': 50, 'food': 60, 'photography': 90, 'shopping': 30},
    'Desert': {'nature': 70, 'adventure': 80, 'beach': 10, 'history': 60, 'culture': 75, 'food': 70, 'photography': 85, 'shopping': 60},
    'Spiritual': {'nature': 50, 'adventure': 20, 'beach': 10, 'history': 70, 'culture': 90, 'food': 60, 'photography': 65, 'shopping': 55},
    'default': {'nature': 50, 'adventure': 50, 'beach': 50, 'history': 50, 'culture': 50, 'food': 50, 'photography': 50, 'shopping': 50}
}

DAY_TITLES = {
    1: 'Arrival and Exploration',
    'nature': 'Nature Discovery',
    'adventure': 'Adventure Day',
    'beach': 'Beach Bliss',
    'history': 'Heritage Exploration',
    'culture': 'Cultural Immersion',
    'food': 'Culinary Journey',
    'photography': 'Photography Expedition',
    'shopping': 'Shopping Spree',
    'relaxation': 'Relaxation Day',
    'wildlife': 'Wildlife Safari'
}


def get_activities_for_interest(interest: str, time_of_day: str) -> List[str]:
    templates = ACTIVITY_TEMPLATES.get(interest, {})
    return templates.get(time_of_day, DEFAULT_ACTIVITIES.get(time_of_day, ['Enjoy your free time']))


def select_activities(
    interests: List[str],
    travel_type: Optional[str],
    destination: Dict,
    duration: int,
    day_number: int,
    pace: str = 'balanced'
) -> Dict[str, List[str]]:
    time_slots = ['morning', 'afternoon', 'evening']
    selected = {}
    
    pace_cfg = PACE_CONFIG.get(pace, PACE_CONFIG['balanced'])
    max_per_slot = pace_cfg['activities_per_slot']
    
    primary_interests = interests[:]
    if not primary_interests:
        cat = destination.get('category', 'default')
        if cat == 'Hill Station':
            primary_interests = ['nature', 'adventure']
        elif cat == 'Beach':
            primary_interests = ['beach', 'relaxation']
        elif cat == 'Heritage':
            primary_interests = ['history', 'culture']
        elif cat == 'Adventure':
            primary_interests = ['adventure']
        elif cat == 'Backwaters':
            primary_interests = ['nature', 'culture']
        else:
            primary_interests = ['nature', 'culture']
    
    all_relevant = list(set(primary_interests + ([travel_type] if travel_type else [])))
    all_relevant = [i for i in all_relevant if i in VALID_INTERESTS or i in VALID_TRAVEL_TYPES]
    
    dest_scores = DESTINATION_INTEREST_SCORES.get(destination.get('category', 'default'), DESTINATION_INTEREST_SCORES['default'])
    
    for slot in time_slots:
        activities = []
        used = set()
        
        scored_interests = sorted(all_relevant, key=lambda i: dest_scores.get(i, 50), reverse=True)
        
        for interest in scored_interests:
            pool = get_activities_for_interest(interest, slot)
            for activity in pool:
                norm = activity.lower()
                if norm not in used and len(activities) < max_per_slot:
                    activities.append(activity)
                    used.add(norm)
        
        if not activities:
            activities = DEFAULT_ACTIVITIES[slot][:max_per_slot]
        
        selected[slot] = activities[:max_per_slot]
    
    return selected


def generate_day_title(day_number: int, duration: int, destination: Dict, travel_type: Optional[str]) -> str:
    if day_number == 1:
        return 'Arrival and Exploration'
    if day_number == duration:
        return 'Departure and Farewell'
    
    type_labels = {
        'nature': 'Nature Discovery',
        'adventure': 'Adventure Day',
        'beach': 'Beach Bliss',
        'history': 'Heritage Exploration',
        'culture': 'Cultural Immersion',
        'food': 'Culinary Journey',
        'photography': 'Photography Expedition',
        'shopping': 'Shopping Spree',
        'relaxation': 'Relaxation Day',
        'wildlife': 'Wildlife Safari'
    }
    
    return type_labels.get(travel_type, f'Day {day_number} Exploration')


def generate_notes(day_number: int, duration: int, destination: Dict, activities: Dict) -> str:
    notes = []
    
    if day_number == 1:
        notes.append('Arrive at destination and check into accommodation')
        notes.append('Allow time for acclimatization and rest')
    
    if day_number == duration:
        notes.append('Check out from accommodation')
        notes.append('Allow buffer time for departure travel')
    
    cat = destination.get('category', '')
    if cat == 'Hill Station' and day_number > 1:
        notes.append('Carry warm clothing for temperature changes')
        notes.append('Stay hydrated at higher altitudes')
    
    if cat == 'Beach':
        notes.append('Apply sunscreen and stay hydrated')
        notes.append('Respect local beach regulations')
    
    all_acts = ' '.join(activities.get('morning', []) + activities.get('afternoon', []) + activities.get('evening', [])).lower()
    if any(kw in all_acts for kw in ['trek', 'hike', 'climb']):
        notes.append('Wear comfortable trekking shoes')
        notes.append('Carry water and snacks for outdoor activities')
    
    if any(kw in all_acts for kw in ['water', 'swim', 'raft', 'kayak', 'snorkel', 'dive', 'boat']):
        notes.append('Bring swimwear and towel for water activities')
        notes.append('Follow safety instructions from guides')
    
    if 'photography' in str(activities).lower() or any(kw in all_acts for kw in ['photo', 'shoot']):
        notes.append('Carry extra batteries and memory cards')
        notes.append('Golden hour (sunrise/sunset) offers best lighting')
    
    notes.append('Keep emergency contacts and local guide information handy')
    
    return '. '.join(notes) + '.'


def calculate_interest_match_score(user_interests: List[str], destination: Dict) -> float:
    dest_scores = DESTINATION_INTEREST_SCORES.get(destination.get('category', 'default'), DESTINATION_INTEREST_SCORES['default'])
    if not user_interests:
        return 50.0
    
    total = sum(dest_scores.get(i, 50) for i in user_interests)
    return total / len(user_interests)


def calculate_budget_match_score(user_budget: float, dest_budget: float, duration: int, travelers: int) -> float:
    if not dest_budget or dest_budget <= 0:
        return 50.0
    
    per_person_per_day = dest_budget / (duration * travelers) if duration * travelers > 0 else 0
    user_per_person_per_day = user_budget / (duration * travelers) if duration * travelers > 0 else 0
    
    if user_per_person_per_day <= 0:
        return 50.0
    
    ratio = min(per_person_per_day / user_per_person_per_day, user_per_person_per_day / per_person_per_day)
    return max(0, min(100, ratio * 100))


def calculate_duration_match_score(user_duration: int, dest_duration: int) -> float:
    if not dest_duration or not user_duration:
        return 50.0
    
    diff = abs(user_duration - dest_duration)
    if diff == 0:
        return 100.0
    elif diff <= 1:
        return 80.0
    elif diff <= 2:
        return 60.0
    elif diff <= 3:
        return 40.0
    return 20.0


def calculate_category_match_score(travel_type: Optional[str], dest_category: str) -> float:
    if not travel_type or not dest_category:
        return 50.0
    
    category_map = {
        'Hill Station': ['nature', 'adventure', 'relaxation', 'honeymoon'],
        'Beach': ['beach', 'relaxation', 'honeymoon', 'family'],
        'Heritage': ['heritage', 'culture', 'spiritual'],
        'Adventure': ['adventure', 'wildlife'],
        'Backwaters': ['relaxation', 'nature', 'honeymoon'],
        'Wildlife': ['wildlife', 'adventure', 'nature'],
        'Desert': ['adventure', 'culture'],
        'Spiritual': ['spiritual', 'heritage']
    }
    
    matching = category_map.get(dest_category, [])
    return 100.0 if travel_type.lower() in matching else (30.0 if matching else 50.0)


def generate_itinerary(data: Dict) -> Dict:
    user_id = data.get('userId')
    destination_id = data.get('destinationId')
    duration = int(data.get('duration', 0))
    budget = float(data.get('budget', 0))
    travelers = int(data.get('travelers', 1))
    interests = data.get('interests', [])
    travel_type = data.get('travelType')
    start_date = data.get('startDate')
    pace = data.get('pace', 'balanced')
    destination = data.get('destination')
    
    if not destination:
        raise ValueError('Destination data is required')
    
    # Ensure destination numeric fields are properly typed
    dest_budget = float(destination.get('estimated_budget', 0) or 0)
    dest_duration = int(destination.get('recommended_duration', 3) or 3)
    destination['estimated_budget'] = dest_budget
    destination['recommended_duration'] = dest_duration
    
    interest_score = calculate_interest_match_score(interests, destination)
    budget_score = calculate_budget_match_score(budget, destination.get('estimated_budget', 0), duration, travelers)
    duration_score = calculate_duration_match_score(duration, destination.get('recommended_duration', 3))
    category_score = calculate_category_match_score(travel_type, destination.get('category', ''))
    
    weights = {'interest': 0.50, 'budget': 0.20, 'duration': 0.15, 'category': 0.15}
    match_score = round(
        interest_score * weights['interest'] +
        budget_score * weights['budget'] +
        duration_score * weights['duration'] +
        category_score * weights['category']
    )
    
    days = []
    for day in range(1, duration + 1):
        activities = select_activities(interests, travel_type, destination, duration, day, pace)
        day_title = generate_day_title(day, duration, destination, travel_type)
        notes = generate_notes(day, duration, destination, activities)
        
        days.append({
            'day_number': day,
            'day_title': day_title,
            'morning_activity': '; '.join(activities['morning']),
            'afternoon_activity': '; '.join(activities['afternoon']),
            'evening_activity': '; '.join(activities['evening']),
            'notes': notes
        })
    
    base_costs = calculate_base_costs(destination, duration, travelers)
    total_estimated = sum(base_costs.values())
    budget_diff = budget - total_estimated
    
    if budget_diff < 0:
        budget_status = 'over_budget'
    elif budget_diff < budget * 0.1:
        budget_status = 'near_budget'
    else:
        budget_status = 'within_budget'
    
    suggestions = []
    if budget_diff < 0:
        suggestions = generate_cost_saving_suggestions(base_costs, abs(budget_diff), travelers, duration)
    
    assumptions = get_assumptions(duration, travelers, destination.get('category', ''))
    
    return {
        'destination': destination,
        'duration': duration,
        'travelers': travelers,
        'budget': budget,
        'total_estimated_cost': round(total_estimated, 2),
        'budget_status': budget_status,
        'budget_breakdown': base_costs,
        'budget_difference': round(budget_diff, 2),
        'suggestions': suggestions,
        'assumptions': assumptions,
        'days': days,
        'start_date': start_date,
        'match_score': match_score,
        'pace': pace
    }


def calculate_base_costs(destination: Dict, duration: int, travelers: int) -> Dict[str, float]:
    BUDGET_DEFAULTS = {
        'TRANSPORT_PER_DAY_PER_PERSON': 800,
        'ACCOMMODATION_PER_NIGHT_PER_PERSON': 2000,
        'FOOD_PER_DAY_PER_PERSON': 800,
        'ACTIVITIES_PER_DAY_PER_PERSON': 500,
        'MISC_PER_DAY_PER_PERSON': 300
    }
    
    CATEGORY_MULTIPLIERS = {
        'Hill Station': {'transport': 1.2, 'accommodation': 1.1, 'food': 1.0, 'activities': 1.1},
        'Beach': {'transport': 1.0, 'accommodation': 1.3, 'food': 1.1, 'activities': 1.0},
        'Heritage': {'transport': 0.9, 'accommodation': 1.0, 'food': 0.9, 'activities': 1.2},
        'Adventure': {'transport': 1.3, 'accommodation': 1.0, 'food': 1.0, 'activities': 1.4},
        'Backwaters': {'transport': 1.1, 'accommodation': 1.2, 'food': 1.0, 'activities': 0.9},
        'Wildlife': {'transport': 1.4, 'accommodation': 1.1, 'food': 1.0, 'activities': 1.3},
        'Desert': {'transport': 1.2, 'accommodation': 1.0, 'food': 0.9, 'activities': 1.1},
        'Spiritual': {'transport': 0.8, 'accommodation': 0.8, 'food': 0.8, 'activities': 0.7},
        'default': {'transport': 1.0, 'accommodation': 1.0, 'food': 1.0, 'activities': 1.0}
    }
    
    cat = destination.get('category', 'default')
    mult = CATEGORY_MULTIPLIERS.get(cat, CATEGORY_MULTIPLIERS['default'])
    
    transport = BUDGET_DEFAULTS['TRANSPORT_PER_DAY_PER_PERSON'] * duration * travelers * mult['transport']
    accommodation = BUDGET_DEFAULTS['ACCOMMODATION_PER_NIGHT_PER_PERSON'] * max(0, duration - 1) * travelers * mult['accommodation']
    food = BUDGET_DEFAULTS['FOOD_PER_DAY_PER_PERSON'] * duration * travelers * mult['food']
    activities = BUDGET_DEFAULTS['ACTIVITIES_PER_DAY_PER_PERSON'] * duration * travelers * mult['activities']
    misc = BUDGET_DEFAULTS['MISC_PER_DAY_PER_PERSON'] * duration * travelers
    
    dest_budget = destination.get('estimated_budget', 0)
    if dest_budget and dest_budget > 0:
        current_per_day = (transport + accommodation + food + activities + misc) / (duration * travelers)
        target_per_day = dest_budget / (duration * travelers)
        if current_per_day > 0:
            factor = min(max(target_per_day / current_per_day, 0.5), 2.0)
            transport *= factor
            accommodation *= factor
            food *= factor
            activities *= factor
            misc *= factor
    
    def round2(v): return round(v, 2)
    
    return {
        'transportation': round2(transport),
        'accommodation': round2(accommodation),
        'food': round2(food),
        'activities': round2(activities),
        'miscellaneous': round2(misc)
    }


def generate_cost_saving_suggestions(costs: Dict, over_amount: float, travelers: int, duration: int) -> List[Dict]:
    suggestions = []
    total = sum(costs.values())
    sorted_costs = sorted(costs.items(), key=lambda x: x[1], reverse=True)
    
    for category, amount in sorted_costs:
        if over_amount <= 0:
            break
        reduction = min(amount * 0.3, over_amount)
        if reduction > 100:
            pct = round((reduction / amount) * 100)
            suggestions.append({
                'category': category.capitalize(),
                'suggestion': f'Reduce {category.lower()} costs by ~{pct}% (save ₹{round(reduction, 2)})',
                'potential_savings': round(reduction, 2)
            })
            over_amount -= reduction
    
    if not suggestions and over_amount > 0:
        suggestions.append({
            'category': 'General',
            'suggestion': 'Consider reducing trip duration by 1 day or traveling with fewer people',
            'potential_savings': round(min(over_amount, total * 0.2), 2)
        })
    
    return suggestions


def get_assumptions(duration: int, travelers: int, category: str) -> List[str]:
    return [
        'Transport: ₹800/day/person (local transport, inter-city travel)',
        f'Accommodation: ₹2000/night/person (mid-range hotels/homestays, {max(0, duration - 1)} nights)',
        'Food: ₹800/day/person (breakfast, lunch, dinner, snacks)',
        'Activities: ₹500/day/person (entry fees, guides, tours)',
        'Miscellaneous: ₹300/day/person (shopping, tips, emergencies)',
        f'Category adjustment applied for "{category}" destinations',
        'All costs are estimates in INR and may vary based on season, booking time, and personal preferences'
    ]


def main():
    try:
        input_data = json.load(sys.stdin)
        result = generate_itinerary(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()