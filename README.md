# TravelMind AI

**Plan Smarter. Travel Better.**

AI-Based Personalized Travel Management System - College Mini Project

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.x
- Python 3.10+ (for AI features, Phase 7+)

### 1. Clone & Install
```bash
cd "E:\Ai based travel manage ment system\backend"
npm install
```

### 2. Configure Database
```bash
# Copy environment template
copy .env.example .env

# Edit .env with your MySQL credentials
# DB_PASSWORD=your_actual_password
```

### 3. Initialize Database
```sql
-- In MySQL shell or Workbench:
SOURCE E:/Ai based travel manage ment system/database/schema.sql;
SOURCE E:/Ai based travel manage ment system/database/seed.sql;
```

### 4. Test Connection
```bash
npm run test:db
```

### 5. Start Server
```bash
npm run dev
```

### 6. Verify
Open http://localhost:3000/api/health

## 📁 Project Structure

```
TravelMind-AI/
├── backend/                 # Express.js API
│   ├── server.js           # Entry point
│   ├── package.json        # Dependencies
│   ├── .env.example        # Env template
│   ├── config/             # Configuration
│   ├── routes/             # API routes
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   └── utils/              # Helpers
│
├── frontend/               # Static pages
│   ├── index.html          # Home page
│   ├── login.html          # Login
│   ├── register.html       # Register
│   ├── dashboard.html      # User dashboard
│   ├── destinations.html   # Destinations list
│   ├── packages.html       # Packages list
│   ├── ai-planner.html     # AI trip planner
│   ├── admin/              # Admin panel
│   ├── css/                # Stylesheets
│   └── js/                 # Client scripts
│
├── ai/                     # Python AI/ML (Phase 7+)
├── database/               # SQL schema & seeds
├── docs/                   # Documentation
└── tests/                  # Test files
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| Backend | Node.js, Express.js |
| Database | MySQL 8.x |
| Auth | bcryptjs, JWT |
| AI/ML | Python, pandas, numpy, scikit-learn |

## 📚 Documentation

- [Architecture](docs/architecture.md) - System design
- [Database](database/README.md) - Schema & setup
- [API Reference](docs/api.md) - All endpoints

## 🗄 Database

### Tables (9)
1. **users** - Accounts & authentication
2. **destinations** - 12 Indian destinations with AI scores
3. **travel_packages** - 13 pre-built packages
4. **user_preferences** - Personalization input
5. **recommendations** - AI recommendation cache
6. **itineraries** - Generated travel plans
7. **itinerary_days** - Day-by-day breakdown
8. **bookings** - User bookings
9. **reviews** - Destination reviews

### Seed Data
- 12 destinations: Coorg, Chikmagalur, Mysuru, Gokarna, Wayanad, Munnar, Ooty, Goa, Jaipur, Udaipur, Manali, Alleppey
- 13 travel packages linked to destinations

## 🔌 API Endpoints

### Public
- `GET /api/health` - Health check
- `GET /api` - API info
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/destinations` - List destinations (with filters, pagination)
- `GET /api/destinations/:id` - Destination details with packages
- `GET /api/destinations/:id/packages` - Destination packages
- `GET /api/packages` - List packages (with filters, pagination)
- `GET /api/packages/:id` - Package details
- `GET /api/reviews/:destinationId` - Destination reviews

### Protected (User)
- `GET /api/preferences` - Get preferences
- `POST /api/preferences` - Save preferences
- `PUT /api/preferences` - Update preferences
- `POST /api/recommendations` - AI recommendations
- `GET /api/recommendations` - Saved recommendations
- `POST /api/itinerary` - Generate itinerary
- `GET /api/itinerary` - List user itineraries
- `GET /api/itinerary/:id` - Get itinerary details
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - My bookings
- `GET /api/bookings/:id` - Booking details
- `PUT /api/bookings/:id/cancel` - Cancel booking
- `POST /api/reviews` - Submit review

### Protected (Admin)
- `GET /api/admin/statistics` - Dashboard stats
- `GET /api/admin/users` - All users
- `GET /api/admin/bookings` - All bookings
- `POST /api/destinations` - Create destination
- `PUT /api/destinations/:id` - Update destination
- `DELETE /api/destinations/:id` - Delete destination
- `POST /api/packages` - Create package
- `PUT /api/packages/:id` - Update package
- `DELETE /api/packages/:id` - Delete package

## 🧪 Testing

```bash
# Test database connection
npm run test:db

# Check server syntax
node --check server.js
node --check config/database.js

# Run authentication tests
npm run test:auth

# Run all tests
npm test
```

## 🌐 Deployment (Render)

1. Push to GitHub
2. Create Render Web Service
3. Build: `npm install`
4. Start: `npm start`
5. Add environment variables in Render dashboard
6. Use managed MySQL (PlanetScale/Railway/Render)

## 📝 Environment Variables

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=travelmind_ai

JWT_SECRET=replace_with_a_long_random_secret_at_least_32_chars
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
```

## 🔐 Security

- ✅ bcrypt password hashing (10 rounds)
- ✅ JWT authentication (1-hour expiry)
- ✅ Parameterized SQL queries
- ✅ Environment-based secrets
- ✅ Role-based access (user/admin)
- ✅ CORS configured
- ✅ Input validation (express-validator)
- ✅ Generic error messages (no user enumeration)
- ✅ Password hashes never exposed in responses
- ✅ Public registration restricted to USER role
- ⏳ Rate limiting (planned)
- ⏳ Helmet.js headers (planned)

## 📦 Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Project structure |
| 2 | ✅ | Express backend + basic frontend |
| 3 | ✅ | MySQL database + schema + seeds |
| 4 | ✅ | Authentication + registration + login |
| 5 | ✅ | Destinations + travel packages APIs |
| 6 | ✅ | User preferences + AI destination recommendations |
| 7 | ✅ | AI itinerary + budget calculator |
| 8 | ⏳ | Booking + My Bookings |
| 9 | ⏳ | Admin dashboard + reviews + chatbot |
| 10 | ⏳ | Final polish + testing + deploy prep |

## 🤝 Contributing

This is a college mini project. For educational purposes.

## 📄 License

College Mini Project - Educational Use

---

**Built with ❤️ for smarter travel planning**