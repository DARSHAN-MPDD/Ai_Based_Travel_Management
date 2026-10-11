# TravelMind AI - Architecture Documentation

## System Overview

TravelMind AI is a monolithic full-stack travel management application with AI-powered personalization features.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   HTML      │  │   CSS       │  │   JavaScript│             │
│  │   Pages     │  │   (Bootstrap)│  │   (Vanilla) │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/REST API
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS BACKEND                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Routes     │ │ Controllers  │ │  Middleware  │            │
│  │  (API Endpts)│ │  (Logic)     │ │  (Auth, Err) │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  Services    │ │   Config     │ │   Utils      │            │
│  │ (Business    │ │  (DB, Env)   │ │  (Logger)    │            │
│  │  Logic)      │ │              │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │  MySQL   │ │  Python  │ │  File    │
       │ Database │ │  AI/ML   │ │  Storage │
       └──────────┘ └──────────┘ └──────────┘
```

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Flexbox, Grid
- **Bootstrap 5.3** - Responsive UI components
- **Font Awesome 6** - Icons
- **Vanilla JavaScript (ES6+)** - No framework dependency

### Backend
- **Node.js** - Runtime
- **Express.js 4.18** - Web framework
- **mysql2/promise** - MySQL driver with Promise support
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment configuration
- **express-validator** - Input validation

### Database
- **MySQL 8.x** - Relational database
- **InnoDB** - Storage engine
- **utf8mb4** - Character encoding

### AI/ML (Phase 7+)
- **Python 3.10+** - Runtime
- **pandas** - Data manipulation
- **numpy** - Numerical computing
- **scikit-learn** - Machine learning

## Project Structure

```
TravelMind-AI/
├── backend/
│   ├── server.js              # Application entry point
│   ├── package.json           # Dependencies & scripts
│   ├── .env                   # Environment variables (not in git)
│   ├── .env.example           # Environment template
│   │
│   ├── config/
│   │   ├── index.js           # Configuration loader
│   │   ├── database.js        # MySQL connection pool
│   │   └── testDatabase.js    # Connection test script
│   │
│   ├── routes/
│   │   ├── authRoutes.js      # Authentication routes
│   │   ├── destinationRoutes.js # Destination & package routes
│   │   ├── packageRoutes.js   # Package management routes
│   │   ├── preferenceRoutes.js # User preference routes
│   │   └── recommendationRoutes.js # Recommendation routes
│   │
│   ├── controllers/
│   │   ├── authController.js  # Authentication logic
│   │   ├── destinationController.js # Destination CRUD
│   │   ├── packageController.js     # Package CRUD
│   │   ├── preferenceController.js  # Preference management
│   │   └── recommendationController.js # Recommendation logic
│   │
│   ├── services/
│   │   └── recommendationService.js # Content-based recommendation engine
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT authentication & authorization
│   │   └── errorMiddleware.js # Error handling
│   │
│   └── utils/                 # Helper functions
│
├── frontend/
│   ├── *.html                 # Page templates
│   ├── admin/                 # Admin panel pages
│   ├── css/                   # Stylesheets
│   └── js/                    # Client-side scripts
│
├── ai/
│   ├── recommendation.py      # Recommendation engine (future Python ML)
│   ├── itinerary.py           # Itinerary generator
│   ├── requirements.txt       # Python dependencies
│   └── data/                  # Training data
│
├── database/
│   ├── schema.sql             # DDL statements
│   ├── seed.sql               # Sample data
│   └── README.md              # Database docs
│
├── docs/
│   ├── architecture.md        # This file
│   ├── database.md            # Database design
│   └── api.md                 # API reference
│
├── tests/
│   ├── api-tests/             # API test cases
│   └── ai-tests/              # AI model tests
│
├── .gitignore
└── README.md
```

## Data Flow

### Request Flow
1. Client makes HTTP request to `/api/*`
2. Express middleware processes request (CORS, JSON parsing, auth)
3. Router directs to appropriate controller
4. Controller calls service layer for business logic
5. Service interacts with database via connection pool
6. Response formatted and sent back to client

### Authentication Flow
1. User registers/logs in via `/api/auth/*`
2. Server validates credentials, generates JWT
3. Client stores JWT in localStorage
4. Subsequent requests include `Authorization: Bearer <token>`
5. Auth middleware verifies token, attaches user to request

### AI Itinerary Generation Flow (Phase 7)
1. User submits itinerary request via `POST /api/itinerary` with destination_id, duration, budget, travelers, interests, travel_type, start_date
2. Backend validates request (destination exists, duration 1-30, budget positive, travelers 1-20)
3. Backend fetches destination data from `destinations` table (description, category, activities, scores, estimated_budget)
4. Itinerary service generates day-by-day plan:
   - Maps user interests/travel_type to activity templates (nature, adventure, beach, history, culture, food, photography, shopping)
   - Selects varied activities for morning/afternoon/evening per day, avoiding duplicates
   - Generates day titles (Arrival, themed days, Departure)
   - Creates practical notes based on destination category and activities
5. Budget service calculates cost breakdown:
   - Base costs per category (transport, accommodation, food, activities, miscellaneous) per day per person
   - Applies category multipliers (Hill Station, Beach, Heritage, Adventure, etc.)
   - Adjusts to match destination's estimated_budget if available
   - Computes total, compares with user budget, generates cost-saving suggestions if over budget
6. Saves itinerary and days in transaction to `itineraries` and `itinerary_days` tables
7. Returns complete itinerary with budget analysis

**Generation Details**:
- **Activity Selection**: Rule-based mapping of interests to activity templates per time of day
- **Deterministic**: Same inputs produce identical itineraries (no randomness)
- **No External AI**: Pure Node.js implementation, no external API calls
- **Budget Assumptions**: Configurable defaults (₹800 transport, ₹2000 accommodation, ₹800 food, ₹500 activities, ₹300 misc per day per person)
- **Category Multipliers**: Adjust costs based on destination type (e.g., Beach → higher accommodation, Adventure → higher transport/activities)
- **Cost Distribution**: Daily costs derived from total breakdown, proportional to activity count

### AI Recommendation Flow
1. User saves preferences via `/api/preferences` (budget, duration, travel_type, interest scores 0-100)
2. User requests recommendations via `POST /api/recommendations`
3. Backend loads user preferences from `user_preferences` table
4. Backend fetches active destinations with their feature scores from `destinations` table
5. Recommendation service calculates match scores using weighted content-based algorithm:
   - **Cosine Similarity** (50%): Compares user interest vector with destination feature vector across 8 dimensions (nature, adventure, beach, history, culture, food, photography, shopping)
   - **Budget Match** (20%): Scores how well destination budget fits user's budget range
   - **Duration Match** (15%): Scores alignment between user's preferred duration and destination's recommended duration
   - **Category Match** (15%): Scores compatibility between user's travel_type and destination category
6. Scores normalized to 0-100, destinations ranked by composite score
7. Top N results returned with human-readable explanations
8. Results cached in `recommendations` table for user

**Algorithm Details**:
- **Cosine Similarity**: Handles cases where user has zero interests (returns neutral 50%)
- **Budget Scoring**: Penalizes destinations over user's max budget, rewards within range
- **Duration Scoring**: Exact match = 100%, ±1 day = 80%, ±2 days = 60%, ±3 days = 40%
- **Category Mapping**: Maps destination categories to compatible travel types (e.g., Hill Station → nature, adventure, relaxation)
- **Deterministic**: Same inputs always produce same rankings
- **No External ML**: Pure Node.js implementation, no Python dependency required for core recommendations

## Database Design

### Core Entities
- **Users** - Authentication and profiles
- **Destinations** - Travel locations with AI scoring
- **Travel Packages** - Commercial offerings
- **User Preferences** - Input for personalization
- **Recommendations** - AI output cache
- **Itineraries** - Generated travel plans
- **Bookings** - Transaction records
- **Reviews** - User-generated content

### Relationships
- User 1→1 UserPreferences
- User 1→N Recommendations
- User 1→N Itineraries
- User 1→N Bookings
- User 1→N Reviews
- Destination 1→N TravelPackages
- Destination 1→N Recommendations
- Destination 1→N Itineraries
- Destination 1→N Reviews
- TravelPackage 1→N Bookings
- Itinerary 1→N ItineraryDays

## API Design Principles

### RESTful Conventions
- Resource-based URLs: `/api/destinations`, `/api/bookings`
- HTTP verbs: GET, POST, PUT, DELETE
- Plural nouns for collections
- Nested resources for relationships

### Response Format
```json
// Success
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}

// Error
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (dev only)"
}
```

### Status Codes
- 200 - OK
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 500 - Server Error
- 503 - Service Unavailable (DB down)

## Security Considerations

### Implemented
- Password hashing with bcrypt (10 rounds)
- JWT with 1-hour expiry
- Parameterized SQL queries (no injection)
- CORS configuration
- Environment-based secrets
- Role-based access control (user/admin)
- Input validation with express-validator
- Generic authentication error messages
- Password hashes never exposed in API responses
- Public registration restricted to USER role

### Planned
- Rate limiting
- Input validation/sanitization
- Helmet.js for security headers
- API request logging

## Deployment

### Development
```bash
cd backend
npm run dev
```

### Production (Render)
1. Set environment variables in Render dashboard
2. Build command: `npm install`
3. Start command: `npm start`
4. MySQL hosted separately (PlanetScale, Railway, or Render MySQL)

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | No (default 3000) |
| NODE_ENV | Environment | No (default development) |
| DB_HOST | MySQL host | Yes |
| DB_PORT | MySQL port | No (default 3306) |
| DB_USER | MySQL user | Yes |
| DB_PASSWORD | MySQL password | Yes |
| DB_NAME | Database name | Yes |
| JWT_SECRET | JWT signing key | Yes |
| JWT_EXPIRES_IN | Token expiry | No (default 1h) |
| BCRYPT_SALT_ROUNDS | Hash rounds | No (default 10) |

## Scalability Notes

Current monolithic architecture supports:
- Vertical scaling (more CPU/RAM)
- Connection pooling (10 connections)
- Stateless API servers (horizontal scaling ready)

Future considerations:
- Redis for session caching
- Read replicas for database
- CDN for static assets
- Message queue for async tasks
- Microservice extraction for AI services