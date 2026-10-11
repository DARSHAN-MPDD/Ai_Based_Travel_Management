# TravelMind AI - API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

## Authentication

All protected endpoints require a JWT in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## Endpoints

---

### Health Check

#### GET /health
Check API and database status.

**Response (200 - Healthy)**
```json
{
  "success": true,
  "service": "TravelMind AI API",
  "status": "healthy",
  "environment": "development",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response (503 - Unhealthy)**
```json
{
  "success": false,
  "service": "TravelMind AI API",
  "status": "unhealthy",
  "environment": "development",
  "database": "disconnected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### API Info

#### GET /
Get API information and available endpoints.

**Response**
```json
{
  "success": true,
  "message": "TravelMind AI API",
  "version": "1.0.0",
  "endpoints": {
    "health": "GET /api/health",
    "auth": {
      "register": "POST /api/auth/register",
      "login": "POST /api/auth/login"
    },
    "destinations": {
      "list": "GET /api/destinations",
      "detail": "GET /api/destinations/:id"
    },
    "packages": {
      "list": "GET /api/packages",
      "detail": "GET /api/packages/:id"
    },
    "chatbot": {
      "message": "POST /api/chatbot/message",
      "session": "GET /api/chatbot/session?session_id=<id>",
      "clearSession": "DELETE /api/chatbot/session?session_id=<id>"
    }
  }
}
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user.

**Request Body**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+91 98765 43210",
  "password": "securepassword"
}
```

**Response (201)**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+91 98765 43210",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**
- 400: Missing required fields
- 409: Email already exists

---

### POST /auth/login
Login with email and password.

**Request Body**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+91 98765 43210",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**
- 400: Missing credentials
- 401: Invalid credentials

---

## Destination Endpoints

### GET /destinations
List all active destinations with pagination and filters.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 12, max 50) |
| search | string | Search in name, location, description |
| category | string | Filter by category |
| minBudget | decimal | Minimum estimated budget |
| maxBudget | decimal | Maximum estimated budget |
| sort | string | Sort: `name`, `budget_asc`, `budget_desc` |

**Response (200)**
```json
{
  "success": true,
  "message": "Destinations retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Coorg",
      "description": "Known as the Scotland of India...",
      "location": "Karnataka",
      "category": "Hill Station",
      "estimated_budget": 15000,
      "recommended_duration": 3,
      "best_time": "October to March",
      "activities": ["Coffee plantation tours", "Trekking"],
      "image_url": "https://images.unsplash.com/...",
      "nature_score": 95,
      "adventure_score": 80,
      "beach_score": 10,
      "history_score": 40,
      "culture_score": 70,
      "food_score": 85,
      "photography_score": 90,
      "shopping_score": 60,
      "is_active": true,
      "created_at": "2024-11-01T10:00:00.000Z",
      "updated_at": "2024-11-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 12,
    "totalPages": 1
  }
}
```

---

### GET /destinations/:id
Get destination details by ID, including its packages.

**Response (200)**
```json
{
  "success": true,
  "message": "Destination retrieved successfully",
  "data": {
    "id": 1,
    "name": "Coorg",
    "description": "...",
    "location": "Karnataka",
    "category": "Hill Station",
    "estimated_budget": 15000,
    "recommended_duration": 3,
    "best_time": "October to March",
    "activities": [...],
    "image_url": "...",
    "nature_score": 95,
    "adventure_score": 80,
    "beach_score": 10,
    "history_score": 40,
    "culture_score": 70,
    "food_score": 85,
    "photography_score": 90,
    "shopping_score": 60,
    "packages": [
      {
        "id": 1,
        "name": "Coorg Coffee Trail",
        "duration_days": 3,
        "price_per_person": 12000,
        "inclusions": [...],
        "exclusions": [...],
        "image_url": "...",
        "max_travelers": 10
      }
    ]
  }
}
```

**Errors**
- 400: Invalid destination ID
- 404: Destination not found

---

### GET /destinations/:id/packages
Get available packages for a specific destination.

**Response (200)**
```json
{
  "success": true,
  "message": "Destination packages retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Coorg Coffee Trail",
      "description": "Experience the best of Coorg...",
      "duration_days": 3,
      "price_per_person": 12000,
      "inclusions": ["2 nights accommodation", "All meals"],
      "exclusions": ["Flights", "Personal expenses"],
      "image_url": "https://images.unsplash.com/...",
      "max_travelers": 10
    }
  ]
}
```

**Errors**
- 400: Invalid destination ID
- 404: Destination not found

---

### POST /destinations (Admin Only)
Create a new destination.

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body**
```json
{
  "name": "New Destination",
  "description": "Description here",
  "location": "State/Region",
  "category": "Hill Station",
  "estimated_budget": 15000,
  "recommended_duration": 3,
  "best_time": "October to March",
  "activities": ["Activity 1", "Activity 2"],
  "image_url": "https://images.unsplash.com/...",
  "nature_score": 90,
  "adventure_score": 70,
  "beach_score": 10,
  "history_score": 50,
  "culture_score": 60,
  "food_score": 80,
  "photography_score": 85,
  "shopping_score": 40
}
```

**Response (201)**
```json
{
  "success": true,
  "message": "Destination created successfully",
  "data": { ... }
}
```

**Errors**
- 400: Validation failed (required fields, score ranges 0-100)
- 401: Access token required
- 403: Administrator access required
- 409: Destination with this name already exists

---

### PUT /destinations/:id (Admin Only)
Update an existing destination.

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body** (any supported fields)
```json
{
  "name": "Updated Name",
  "estimated_budget": 18000,
  "nature_score": 95
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Destination updated successfully",
  "data": { ... }
}
```

**Errors**
- 400: Invalid destination ID or no valid fields to update
- 401: Access token required
- 403: Administrator access required
- 404: Destination not found
- 409: Destination with this name already exists

---

### DELETE /destinations/:id (Admin Only)
Delete a destination.

**Headers**: `Authorization: Bearer <admin_token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Destination deleted successfully"
}
```

**Errors**
- 400: Invalid destination ID
- 401: Access token required
- 403: Administrator access required
- 404: Destination not found
- 409: Cannot delete - related records exist (packages, bookings, reviews, etc.)

---

## Travel Package Endpoints

### GET /packages
List all active travel packages with pagination and filters.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 12, max 50) |
| search | string | Search in name, description, destination |
| destinationId | integer | Filter by destination ID |
| minPrice | decimal | Minimum price per person |
| maxPrice | decimal | Maximum price per person |
| duration | integer | Filter by duration in days |
| sort | string | Sort: `price_asc`, `price_desc`, `name`, `duration` |

**Response (200)**
```json
{
  "success": true,
  "message": "Packages retrieved successfully",
  "data": [
    {
      "id": 1,
      "destination_id": 1,
      "name": "Coorg Coffee Trail",
      "description": "Experience the best of Coorg...",
      "duration_days": 3,
      "price_per_person": 12000,
      "inclusions": ["2 nights accommodation", "All meals"],
      "exclusions": ["Flights", "Personal expenses"],
      "image_url": "https://images.unsplash.com/...",
      "max_travelers": 10,
      "is_active": true,
      "created_at": "2024-11-01T10:00:00.000Z",
      "updated_at": "2024-11-01T10:00:00.000Z",
      "destination_name": "Coorg",
      "destination_location": "Karnataka",
      "destination_category": "Hill Station",
      "destination_image": "https://images.unsplash.com/..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 13,
    "totalPages": 2
  }
}
```

---

### GET /packages/:id
Get package details by ID with destination information.

**Response (200)**
```json
{
  "success": true,
  "message": "Package retrieved successfully",
  "data": {
    "id": 1,
    "destination_id": 1,
    "name": "Coorg Coffee Trail",
    "description": "...",
    "duration_days": 3,
    "price_per_person": 12000,
    "inclusions": [...],
    "exclusions": [...],
    "image_url": "...",
    "max_travelers": 10,
    "destination_name": "Coorg",
    "destination_location": "Karnataka",
    "destination_category": "Hill Station",
    "destination_description": "...",
    "destination_image": "..."
  }
}
```

**Errors**
- 400: Invalid package ID
- 404: Package not found

---

### POST /packages (Admin Only)
Create a new travel package.

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body**
```json
{
  "destination_id": 1,
  "name": "New Package",
  "description": "Package description",
  "duration_days": 4,
  "price_per_person": 15000,
  "inclusions": ["Accommodation", "Meals", "Guide"],
  "exclusions": ["Flights", "Personal expenses"],
  "image_url": "https://images.unsplash.com/...",
  "max_travelers": 10
}
```

**Response (201)**
```json
{
  "success": true,
  "message": "Package created successfully",
  "data": { ... }
}
```

**Errors**
- 400: Validation failed (required fields, positive values)
- 401: Access token required
- 403: Administrator access required
- 404: Destination not found or inactive

---

### PUT /packages/:id (Admin Only)
Update an existing travel package.

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body** (any supported fields)
```json
{
  "name": "Updated Package Name",
  "price_per_person": 16000,
  "duration_days": 5
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Package updated successfully",
  "data": { ... }
}
```

**Errors**
- 400: Invalid package ID or no valid fields to update
- 401: Access token required
- 403: Administrator access required
- 404: Package not found
- 409: Destination not found or inactive

---

### DELETE /packages/:id (Admin Only)
Delete a travel package.

**Headers**: `Authorization: Bearer <admin_token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Package deleted successfully"
}
```

**Errors**
- 400: Invalid package ID
- 401: Access token required
- 403: Administrator access required
- 404: Package not found
- 409: Cannot delete - related bookings exist

---

## User Preference Endpoints (Protected)

### GET /preferences
Get current user's saved travel preferences.

**Headers**: `Authorization: Bearer <token>`

**Response (200) - Preferences Found**
```json
{
  "success": true,
  "message": "Preferences retrieved successfully",
  "data": {
    "user_id": 1,
    "budget_min": 5000,
    "budget_max": 20000,
    "preferred_duration": 3,
    "travel_type": "nature",
    "nature_interest": 90,
    "adventure_interest": 70,
    "beach_interest": 20,
    "history_interest": 30,
    "culture_interest": 60,
    "food_interest": 80,
    "photography_interest": 85,
    "shopping_interest": 40,
    "created_at": "2024-11-15T10:00:00.000Z",
    "updated_at": "2024-11-15T10:00:00.000Z"
  }
}
```

**Response (200) - No Preferences Saved**
```json
{
  "success": true,
  "message": "No preferences saved yet",
  "data": null
}
```

---

### POST /preferences
Create or save the authenticated user's travel preferences (upsert).

**Headers**: `Authorization: Bearer <token>`

**Request Body** (all fields optional, at least one required)
```json
{
  "budget_min": 5000,
  "budget_max": 20000,
  "preferred_duration": 3,
  "travel_type": "nature",
  "nature_interest": 90,
  "adventure_interest": 70,
  "beach_interest": 20,
  "history_interest": 30,
  "culture_interest": 60,
  "food_interest": 80,
  "photography_interest": 85,
  "shopping_interest": 40
}
```

**Validation Rules**:
- `budget_min`, `budget_max`: Positive numbers, `budget_min` ≤ `budget_max`
- `preferred_duration`: Positive integer
- `travel_type`: One of `nature`, `adventure`, `beach`, `heritage`, `culture`, `spiritual`, `wildlife`, `relaxation`, `family`, `honeymoon`, `budget`, `luxury`
- All interest scores (`*_interest`): Integers between 0 and 100

**Response (200)**
```json
{
  "success": true,
  "message": "Preferences saved successfully",
  "data": { ... }
}
```

**Errors**:
- 400: Validation failed
- 401: Access token required

---

### PUT /preferences
Update the authenticated user's saved preferences.

**Headers**: `Authorization: Bearer <token>`

**Request Body** (any supported fields)
```json
{
  "nature_interest": 95,
  "budget_max": 25000
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": { ... }
}
```

**Errors**:
- 400: No valid fields to update or validation failed
- 401: Access token required
- 404: No preferences found to update (use POST first)

---

## Recommendation Endpoints (Protected)

### POST /recommendations
Generate personalized destination recommendations based on user preferences.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | integer | Number of recommendations (default 5, max 20) |

**Requirements**:
- User must have saved preferences first
- Returns top N destinations ranked by match score

**Response (200)**
```json
{
  "success": true,
  "message": "Personalized recommendations generated successfully",
  "data": [
    {
      "destination_id": 1,
      "name": "Coorg",
      "location": "Karnataka, India",
      "category": "Hill Station",
      "estimated_budget": 15000,
      "recommended_duration": 3,
      "image_url": "https://images.unsplash.com/...",
      "match_score": 92,
      "reason": "Excellent match for your interest in nature, photography and adventure. Estimated budget fits well within your range. Recommended duration matches your available time. Hill Station destination aligns with your travel style."
    }
  ]
}
```

**Errors**:
- 400: User preferences not saved yet
- 401: Access token required
- 404: No active destinations available
- 422: Invalid limit parameter

---

### GET /recommendations
Get previously generated and saved recommendations for the user.

**Headers**: `Authorization: Bearer <token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Saved recommendations retrieved",
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "destination_id": 1,
      "match_percentage": 92,
      "reason": "Excellent match for your interest...",
      "created_at": "2024-11-15T10:30:00.000Z",
      "name": "Coorg",
      "location": "Karnataka",
      "category": "Hill Station",
      "estimated_budget": 15000,
      "recommended_duration": 3,
      "image_url": "https://images.unsplash.com/..."
    }
  ]
}
```

**Errors**:
- 401: Access token required

---

## Itinerary Endpoints (Protected)

### POST /itinerary
Generate a personalized day-by-day itinerary with budget planning.

**Headers**: `Authorization: Bearer <token>`

**Request Body**
```json
{
  "destination_id": 1,
  "duration": 3,
  "budget": 15000,
  "travelers": 2,
  "interests": ["nature", "photography", "adventure"],
  "travel_type": "nature",
  "start_date": "2026-11-15"
}
```

**Field Validation**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| destination_id | integer | Yes | Must be a valid active destination ID |
| duration | integer | Yes | 1-30 days |
| budget | decimal | Yes | Positive, max ₹1,00,00,000 |
| travelers | integer | Yes | 1-20 people |
| interests | array | No | Valid values: nature, adventure, beach, history, culture, food, photography, shopping |
| travel_type | string | No | Valid: nature, adventure, beach, heritage, culture, spiritual, wildlife, relaxation, family, honeymoon, budget, luxury |
| start_date | string | No | ISO 8601 date (YYYY-MM-DD) |

**Response (201)**
```json
{
  "success": true,
  "message": "Itinerary generated successfully",
  "data": {
    "itinerary_id": 1,
    "destination": {
      "id": 1,
      "name": "Coorg"
    },
    "duration": 3,
    "number_of_travelers": 2,
    "budget": 15000,
    "total_estimated_cost": 17500,
    "budget_status": "within_budget",
    "budget_breakdown": {
      "transportation": 4000,
      "accommodation": 6000,
      "food": 3500,
      "activities": 2500,
      "miscellaneous": 1500
    },
    "budget_difference": -2500,
    "suggestions": [],
    "assumptions": [
      "Transport: ₹800/day/person (local transport, inter-city travel)",
      "Accommodation: ₹2000/night/person (mid-range hotels/homestays, 2 nights)",
      "Food: ₹800/day/person (breakfast, lunch, dinner, snacks)",
      "Activities: ₹500/day/person (entry fees, guides, tours)",
      "Miscellaneous: ₹300/day/person (shopping, tips, emergencies)",
      "Category adjustment applied for \"Hill Station\" destinations",
      "All costs are estimates in INR and may vary based on season, booking time, and personal preferences"
    ],
    "days": [
      {
        "day_number": 1,
        "day_title": "Arrival and Exploration",
        "morning_activity": "Arrival and check-in at coffee estate resort; Coffee plantation guided tour",
        "afternoon_activity": "Lunch at local restaurant; Visit Abbey Falls",
        "evening_activity": "Relax at resort, bonfire; Dinner at resort",
        "estimated_cost": 5500,
        "notes": "Arrive at destination and check into accommodation. Allow time for acclimatization and rest. Wear comfortable trekking shoes. Carry water and snacks for outdoor activities. Keep emergency contacts and local guide information handy."
      }
    ]
  }
}
```

**Errors**
- 400: Validation failed (missing required fields, invalid values)
- 401: Access token required
- 404: Destination not found
- 500: Failed to generate itinerary

---

### GET /itinerary/:id
Get saved itinerary by ID with full details and budget breakdown.

**Headers**: `Authorization: Bearer <token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Itinerary retrieved successfully",
  "data": {
    "itinerary_id": 1,
    "destination": {
      "id": 1,
      "name": "Coorg",
      "location": "Karnataka",
      "category": "Hill Station",
      "image_url": "https://images.unsplash.com/...",
      "estimated_budget": 15000
    },
    "duration": 3,
    "number_of_travelers": 2,
    "budget": 15000,
    "total_estimated_cost": 17500,
    "budget_status": "within_budget",
    "budget_breakdown": {
      "transportation": 4000,
      "accommodation": 6000,
      "food": 3500,
      "activities": 2500,
      "miscellaneous": 1500
    },
    "budget_difference": -2500,
    "suggestions": [],
    "assumptions": [...],
    "travel_type": "nature",
    "interests": ["nature", "photography"],
    "start_date": "2026-11-15",
    "status": "finalized",
    "created_at": "2026-10-11T10:30:00.000Z",
    "days": [...]
  }
}
```

**Errors**
- 400: Invalid itinerary ID
- 401: Access token required
- 404: Itinerary not found (or belongs to another user)
- 500: Failed to retrieve itinerary

---

### GET /itinerary
Get authenticated user's saved itineraries with pagination.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 10, max 20) |

**Response (200)**
```json
{
  "success": true,
  "message": "Itineraries retrieved successfully",
  "data": [
    {
      "itinerary_id": 1,
      "destination": {
        "id": 1,
        "name": "Coorg",
        "location": "Karnataka",
        "category": "Hill Station",
        "image_url": "https://images.unsplash.com/..."
      },
      "duration": 3,
      "travelers": 2,
      "budget": 15000,
      "total_estimated_cost": 17500,
      "status": "finalized",
      "created_at": "2026-10-11T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

**Errors**
- 400: Invalid pagination parameters
- 401: Access token required
- 500: Failed to retrieve itineraries

---

## Booking Endpoints (Protected)

All booking endpoints require a valid JWT token.

### POST /bookings

Create a new booking. The total amount is calculated server-side from the actual package price multiplied by the traveler count. Client-supplied prices or totals are ignored.

**Headers**: `Authorization: Bearer <token>`

**Request Body**
```json
{
  "package_id": 1,
  "travel_date": "2024-12-25",
  "travelers": 2,
  "special_requests": "Vegetarian meals preferred"
}
```

**Field Validation**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| package_id | integer | Yes | Must be a positive integer referencing an active package |
| travel_date | string | Yes | ISO 8601 date (YYYY-MM-DD), must be in the future |
| travelers | integer | Yes | 1–20 |
| special_requests | string | No | Max 1000 characters |

**Response (201)**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": 1,
    "booking_id": "TM20241225001",
    "user_id": 1,
    "package_id": 1,
    "destination_id": 1,
    "travel_date": "2024-12-25",
    "travelers": 2,
    "total_amount": 24000,
    "status": "PENDING",
    "payment_status": "pending",
    "special_requests": "Vegetarian meals preferred",
    "package_name": "Coorg Coffee Trail",
    "destination_name": "Coorg",
    "created_at": "2024-11-15T10:30:00.000Z",
    "updated_at": "2024-11-15T10:30:00.000Z"
  }
}
```

**Errors**
- 400: Validation failed
- 401: Access token required
- 404: Package not found

---

### GET /bookings

Get the authenticated user's bookings with pagination.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 10, max 50) |

**Response (200)**
```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": [
    {
      "id": 1,
      "booking_id": "TM20241225001",
      "package_id": 1,
      "package_name": "Coorg Coffee Trail",
      "destination_id": 1,
      "destination_name": "Coorg",
      "travel_date": "2024-12-25",
      "travelers": 2,
      "total_amount": 24000,
      "status": "CONFIRMED",
      "payment_status": "pending",
      "created_at": "2024-11-15T10:30:00.000Z",
      "updated_at": "2024-11-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

**Errors**
- 401: Access token required

---

### GET /bookings/:id

Get detailed booking information. Users can only view their own bookings; administrators can view any booking.

**Headers**: `Authorization: Bearer <token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Booking retrieved successfully",
  "data": {
    "id": 1,
    "booking_id": "TM20241225001",
    "user_id": 1,
    "package_id": 1,
    "destination_id": 1,
    "travel_date": "2024-12-25",
    "travelers": 2,
    "total_amount": 24000,
    "status": "PENDING",
    "payment_status": "pending",
    "special_requests": "Vegetarian meals preferred",
    "package_name": "Coorg Coffee Trail",
    "package_duration_days": 3,
    "package_price_per_person": 12000,
    "package_inclusions": ["2 nights accommodation", "All meals"],
    "destination_name": "Coorg",
    "destination_location": "Karnataka",
    "created_at": "2024-11-15T10:30:00.000Z",
    "updated_at": "2024-11-15T10:30:00.000Z"
  }
}
```

**Errors**
- 400: Invalid booking ID
- 401: Access token required
- 404: Booking not found (or belongs to another user)

---

### PUT /bookings/:id/cancel

Cancel a booking. Only bookings in `PENDING` or `CONFIRMED` status can be cancelled. Cancelled bookings cannot be re-cancelled. Booking records are preserved (updated, not deleted).

**Headers**: `Authorization: Bearer <token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "id": 1,
    "booking_id": "TM20241225001",
    "status": "CANCELLED"
  }
}
```

**Errors**
- 400: Invalid booking ID
- 401: Access token required
- 404: Booking not found
- 409: Booking cannot be cancelled (already cancelled or completed)

---

## Admin Booking Endpoints (Protected - Admin Role Required)

### GET /admin/bookings

List all bookings across all users. Supports pagination and status filtering.

**Headers**: `Authorization: Bearer <admin_token>`

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 10, max 50) |
| status | string | Filter by status: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED` |

**Response (200)**
```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": [
    {
      "id": 1,
      "booking_id": "TM20241225001",
      "user_id": 1,
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "package_id": 1,
      "package_name": "Coorg Coffee Trail",
      "destination_id": 1,
      "destination_name": "Coorg",
      "travel_date": "2024-12-25",
      "travelers": 2,
      "total_amount": 24000,
      "status": "CONFIRMED",
      "payment_status": "pending",
      "created_at": "2024-11-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

**Errors**
- 401: Access token required
- 403: Insufficient permissions
- 400: Invalid pagination or status filter parameters

---

### PUT /admin/bookings/:id/status

Update the status of any booking. Status transitions are validated against the current booking status.

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body**
```json
{
  "status": "CONFIRMED"
}
```

**Valid Status Transitions**
| From | Allowed To |
|------|------------|
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | CANCELLED, COMPLETED |
| CANCELLED | (none — cannot be reopened) |
| COMPLETED | (none — cannot be reopened) |

**Response (200)**
```json
{
  "success": true,
  "message": "Booking status updated successfully",
  "data": {
    "id": 1,
    "booking_id": "TM20241225001",
    "status": "CONFIRMED"
  }
}
```

**Errors**
- 400: Invalid booking ID or status
- 401: Access token required
- 403: Insufficient permissions
- 404: Booking not found
- 409: Invalid status transition

---

### Booking Status Reference

| Status | Description |
|--------|-------------|
| PENDING | New booking awaiting confirmation |
| CONFIRMED | Booking has been confirmed |
| CANCELLED | Booking has been cancelled by user or admin |
| COMPLETED | Travel has been completed |

### Payment Status Reference

| Status | Description |
|--------|-------------|
| pending | Payment has not been processed |
| paid | Payment has been completed |
| refunded | Payment has been refunded |

> **Note**: Payment processing and refunds are not currently implemented. All new bookings are created with `payment_status: "pending"`.

### Price Calculation

- The total booking amount is calculated server-side as: `package.price_per_person × travelers`
- The price is always fetched from the database at booking time — never trusted from client input
- The original price is preserved in the booking record even if the package price changes later

### Cancellation Rules

- Only bookings in `PENDING` or `CONFIRMED` status can be cancelled
- `CANCELLED` bookings cannot be cancelled again (returns 409)
- `COMPLETED` bookings cannot be cancelled (returns 409)
- Cancellation updates the status field; the booking record is never deleted
- Booking history is preserved for audit purposes

---

## Review Endpoints

All review listing and summary endpoints are publicly accessible. Review submission, update, and deletion require authentication.

### POST /reviews

Submit a review for a destination.

**Headers**: `Authorization: Bearer <token>`

**Request Body**
```json
{
  "destination_id": 1,
  "rating": 5,
  "title": "Amazing experience!",
  "comment": "The coffee plantations were breathtaking..."
}
```

**Field Validation**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| destination_id | integer | Yes | Must be a positive integer referencing an existing destination |
| rating | integer | Yes | Must be between 1 and 5 |
| title | string | No | Max 200 characters |
| comment | string | Yes | Must be 1–2000 characters (trimmed) |

**Security**: User ID is obtained from the verified JWT. Any `user_id` or `role` in the request body is ignored.

**Response (201)**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "id": 1,
    "destination_id": 1,
    "user_id": 1,
    "rating": 5,
    "title": "Amazing experience!",
    "comment": "The coffee plantations were breathtaking...",
    "is_verified": true,
    "user_name": "John Doe",
    "created_at": "2024-11-15T10:30:00.000Z",
    "updated_at": "2024-11-15T10:30:00.000Z"
  }
}
```

**Errors**
- 400: Validation failed
- 401: Access token required
- 404: Destination not found

---

### GET /reviews/:destinationId

List reviews for a destination. Public access.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 10, max 50, capped in controller) |

**Response (200)**
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "destination_id": 1,
      "rating": 5,
      "title": "Amazing experience!",
      "comment": "The coffee plantations were breathtaking...",
      "is_verified": true,
      "created_at": "2024-11-15T10:30:00.000Z",
      "updated_at": "2024-11-15T10:30:00.000Z",
      "user_name": "John Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

**Privacy**: Only `user_name` is returned. Email addresses, password hashes, and other private account fields are never exposed.

**Errors**
- 400: Invalid destination ID
- 404: Destination not found

---

### GET /reviews/:destinationId/summary

Get review statistics for a destination. Public access.

**Response (200)**
```json
{
  "success": true,
  "message": "Review summary retrieved successfully",
  "data": {
    "destination_id": 1,
    "average_rating": 4.3,
    "total_reviews": 42,
    "rating_distribution": {
      "1": 2,
      "2": 1,
      "3": 5,
      "4": 10,
      "5": 24
    }
  }
}
```

**Empty Review Response**
```json
{
  "success": true,
  "message": "Review summary retrieved successfully",
  "data": {
    "destination_id": 1,
    "average_rating": 0,
    "total_reviews": 0,
    "rating_distribution": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0
    }
  }
}
```

---

### PUT /reviews/:id

Update a review. Only the review owner can update their review.

**Headers**: `Authorization: Bearer <token>`

**Request Body**
```json
{
  "rating": 4,
  "title": "Updated title",
  "comment": "Updated review comment"
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": { "...updated review..." }
}
```

**Errors**
- 400: Invalid review ID or validation failed
- 401: Access token required
- 403: Cannot edit another user's review
- 404: Review not found

---

### DELETE /reviews/:id

Delete a review. Only the review owner can delete their review.

**Headers**: `Authorization: Bearer <token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Review deleted successfully",
  "data": {
    "id": 1
  }
}
```

**Errors**
- 400: Invalid review ID
- 401: Access token required
- 403: Cannot delete another user's review
- 404: Review not found

---

## Admin Review Endpoints (Protected - Admin Role Required)

### GET /admin/reviews

List all reviews across all destinations (Admin only).

**Headers**: `Authorization: Bearer <admin_token>`

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default 1) |
| limit | integer | Results per page (default 10, max 50) |
| rating | integer | Filter by rating (1–5) |

**Response (200)**
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "id": 1,
      "destination_id": 1,
      "destination_name": "Coorg",
      "user_id": 1,
      "user_name": "John Doe",
      "rating": 5,
      "title": "Amazing experience!",
      "comment": "The coffee plantations were breathtaking...",
      "is_verified": true,
      "created_at": "2024-11-15T10:30:00.000Z",
      "updated_at": "2024-11-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

**Errors**
- 400: Invalid query parameters
- 401: Access token required
- 403: Insufficient permissions

---

### DELETE /admin/reviews/:id

Delete any review as an administrator (Admin only). Preserves all related records (users, destinations, etc.).

**Headers**: `Authorization: Bearer <admin_token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Review deleted successfully",
  "data": {
    "id": 1
  }
}
```

**Errors**
- 400: Invalid review ID
- 401: Access token required
- 403: Insufficient permissions
- 404: Review not found

---

### Review Policy

- The `reviews` table allows **multiple reviews per user per destination**. Each review is stored as a separate record.
- Ratings are constrained to 1–5 at both the application and database level (`CHECK (rating >= 1 AND rating <= 5)`).
- New reviews from authenticated users are marked `is_verified = TRUE`.
- Average ratings are calculated from actual database records using `AVG()` and rounded to 1 decimal place.
- Review deletion removes only the review record; users, destinations, and other related data are preserved.

---

## Admin Endpoints (Protected - Admin Role Required)

### GET /admin/statistics
Get dashboard statistics.

**Headers**: `Authorization: Bearer <admin_token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Statistics retrieved",
  "data": {
    "total_users": 150,
    "total_destinations": 12,
    "total_packages": 13,
    "total_bookings": 89,
    "confirmed_bookings": 67,
    "pending_bookings": 15
  }
}
```

---

### GET /admin/users
List all users (Admin).

**Headers**: `Authorization: Bearer <admin_token>`

**Response (200)**
```json
{
  "success": true,
  "message": "Users retrieved",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_active": true,
      "created_at": "2024-11-01T10:00:00.000Z"
    }
  ]
}
```

---

## Chatbot Endpoints

The chatbot provides a conversational AI assistant for destinations, packages, itineraries, bookings, and reviews. Authentication is optional for messaging and session management — when a valid JWT is provided, sessions are tied to the user and ownership is enforced.

### POST /chatbot/message
Send a message to the AI Travel Assistant and receive an intelligent response.

**Headers** (optional): `Authorization: Bearer <token>` — enables authenticated features like personalized recommendations, booking status, and session ownership

**Request Body**
```json
{
  "message": "I have 10000 for 3 days",
  "session_id": "chat_xyz123_abcde"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| message | string | Yes | 1–2000 characters |
| session_id | string | No | 1–100 characters; auto-generated if omitted |

**Response (200)**
```json
{
  "success": true,
  "message": "Chatbot response generated successfully",
  "data": {
    "session_id": "chat_mv42v9ka_akchc",
    "intent": "budget_itinerary",
    "reply": "Here is a 3-day trip to Chatbot Test Dest within your budget of ₹10000:...",
    "suggestions": [
      "Plan a 4-day trip within 12000",
      "Three-day trip within 8000",
      "5-day budget trip under 15000"
    ],
    "data": {
      "results": null,
      "destination": {
        "id": 78,
        "name": "Chatbot Test Dest",
        "location": "Karnataka",
        "category": "Hill Station",
        "estimated_budget": 8000,
        "recommended_duration": 3,
        "image_url": "https://test.com"
      },
      "summary": null,
      "itinerary": { ... },
      "budget": 10000,
      "duration": 3,
      "message": null
    }
  }
}
```

**Supported intents:**
| Intent | Description |
|--------|-------------|
| `destination_details` | "Tell me about Coorg" |
| `destination_search` | "What destinations are in Karnataka?" |
| `recommendations` | "Recommend destinations for me" (requires auth + saved preferences) |
| `itinerary_help` | "Plan a trip" / "Help me plan a three-day itinerary" |
| `budget_itinerary` | "I have 10000 for 3 days" |
| `budget_planning` | "Destinations within 8000" |
| `package_search` | "Show me travel packages" |
| `booking_status` | "What is my booking status?" (requires auth) |
| `review_summary` | "What is the rating for Coorg?" |
| `preferences` | "My travel preferences" (requires auth) |
| `general_travel_help` | "What travel tips do you have?" |
| `unknown` | Unrecognized queries |

**Errors**
- 400: Validation failed (empty message, message too long, invalid session_id format)

---

### GET /chatbot/session
Retrieve message history for a specific chat session.

**Headers** (optional): `Authorization: Bearer <token>` — if provided, only returns the session if it belongs to the authenticated user

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| session_id | string | Yes | Session ID (1–100 characters) |

**Response (200)**
```json
{
  "success": true,
  "message": "Session retrieved successfully",
  "data": {
    "session_id": "chat_abc123_def45",
    "messages": [
      { "role": "user", "content": "Tell me about Coorg", "timestamp": 1234567890 },
      { "role": "assistant", "content": "Coorg in Karnataka is a Hill Station...", "timestamp": 1234567891 }
    ]
  }
}
```

**Errors**
- 400: Validation failed (missing or invalid session_id)
- 404: Session not found (or belongs to another user)

---

### DELETE /chatbot/session
Clear (delete) a chat session. Session ownership is enforced when authenticated.

**Headers** (optional): `Authorization: Bearer <token>`

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| session_id | string | Yes | Session ID (1–100 characters) |

**Response (200)**
```json
{
  "success": true,
  "message": "Session cleared successfully",
  "data": {
    "session_id": "chat_abc123_def45"
  }
}
```

**Errors**
- 400: Validation failed (missing or invalid session_id)
- 404: Session not found (or belongs to another user)

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate resource |
| SERVER_ERROR | 500 | Internal server error |
| SERVICE_UNAVAILABLE | 503 | Database unavailable |

---

## Rate Limiting (Planned)

- 100 requests/minute per IP for public endpoints
- 200 requests/minute per user for authenticated endpoints
- 50 requests/minute for AI endpoints

---

## Versioning

Current version: v1
- URL path: `/api/`
- Header: `Accept: application/vnd.travelmind.v1+json`