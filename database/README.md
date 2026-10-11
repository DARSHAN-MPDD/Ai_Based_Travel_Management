# Database Documentation

## Overview

This directory contains the MySQL database schema and seed data for the TravelMind AI application.

## Files

- `schema.sql` - Complete database schema with 9 tables
- `seed.sql` - Sample data for 12 destinations and 12 travel packages
- `README.md` - This file

## Tables

### 1. users
Stores user accounts and admin accounts.
- `id` - Primary key
- `name` - User's full name
- `email` - Unique email address
- `phone` - Phone number
- `password_hash` - Bcrypt hashed password
- `role` - 'user' or 'admin'
- `is_active` - Account status
- `created_at`, `updated_at` - Timestamps

### 2. destinations
Stores travel destination information with AI preference scores.
- `id` - Primary key
- `name` - Destination name
- `description` - Detailed description
- `location` - State/region
- `category` - Type (Hill Station, Beach, Heritage, Adventure, Backwaters)
- `estimated_budget` - Estimated cost in INR
- `recommended_duration` - Days recommended
- `best_time` - Best season to visit
- `activities` - JSON array of activities
- `image_url` - Unsplash image URL
- `nature_score` through `shopping_score` - Preference scores (0-100)
- `is_active` - Visibility flag
- `created_at`, `updated_at` - Timestamps

### 3. travel_packages
Pre-built travel packages linked to destinations.
- `id` - Primary key
- `destination_id` - Foreign key to destinations
- `name` - Package name
- `description` - Package description
- `duration_days` - Duration in days
- `price_per_person` - Price in INR
- `inclusions` - JSON array of included items
- `exclusions` - JSON array of excluded items
- `image_url` - Package image
- `max_travelers` - Maximum group size
- `is_active` - Visibility flag
- `created_at`, `updated_at` - Timestamps

### 4. user_preferences
User travel preferences for AI recommendations.
- `id` - Primary key
- `user_id` - Foreign key to users (unique)
- `budget_min`, `budget_max` - Budget range
- `preferred_duration` - Preferred trip length
- `travel_type` - Type of travel
- `nature_interest` through `shopping_interest` - Interest scores (0-100)
- `created_at`, `updated_at` - Timestamps

### 5. recommendations
AI-generated destination recommendations.
- `id` - Primary key
- `user_id` - Foreign key to users
- `destination_id` - Foreign key to destinations
- `match_percentage` - Match score (0-100)
- `reason` - Explanation for recommendation
- `created_at` - Timestamp

### 6. itineraries
Generated travel itineraries.
- `id` - Primary key
- `user_id` - Foreign key to users
- `destination_id` - Foreign key to destinations
- `destination_name` - Cached destination name
- `total_days` - Duration
- `budget` - User budget
- `travelers` - Number of travelers
- `interests` - JSON array of interests
- `travel_type` - Type of travel
- `total_estimated_cost` - Calculated cost
- `status` - 'draft' or 'finalized'
- `created_at`, `updated_at` - Timestamps

### 7. itinerary_days
Day-by-day breakdown of itineraries.
- `id` - Primary key
- `itinerary_id` - Foreign key to itineraries
- `day_number` - Day number (1, 2, 3...)
- `morning_activity` - Morning plan
- `afternoon_activity` - Afternoon plan
- `evening_activity` - Evening plan
- `estimated_cost` - Day cost estimate
- `notes` - Additional notes
- `created_at` - Timestamp

### 8. bookings
User bookings for travel packages.
- `id` - Primary key
- `booking_id` - Unique booking reference
- `user_id` - Foreign key to users
- `package_id` - Foreign key to travel_packages
- `destination_id` - Foreign key to destinations
- `travel_date` - Travel date
- `travelers` - Number of travelers
- `total_amount` - Total cost
- `status` - PENDING, CONFIRMED, CANCELLED, COMPLETED
- `payment_status` - pending, paid, refunded
- `special_requests` - Any special requests
- `created_at`, `updated_at` - Timestamps

### 9. reviews
User reviews for destinations.
- `id` - Primary key
- `user_id` - Foreign key to users
- `destination_id` - Foreign key to destinations
- `rating` - 1-5 stars
- `title` - Review title
- `comment` - Review text
- `is_verified` - Verified booking flag
- `created_at`, `updated_at` - Timestamps

## Setup Instructions

### 1. Start MySQL on Windows

Option A: Using MySQL Installer (if installed as service)
```powershell
net start mysql80
```

Option B: Using MySQL Workbench
- Open MySQL Workbench
- Connect to local instance
- Ensure server is running

Option C: Using Command Line
```powershell
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
```

### 2. Create and Initialize Database

```powershell
# Connect to MySQL
mysql -u root -p

# In MySQL shell, run:
SOURCE E:/Ai based travel manage ment system/database/schema.sql;
SOURCE E:/Ai based travel manage ment system/database/seed.sql;

# Or from PowerShell:
mysql -u root -p < E:/Ai based travel manage ment system/database/schema.sql
mysql -u root -p < E:/Ai based travel manage ment system/database/seed.sql
```

### 3. Configure Backend Environment

Copy the example environment file and update with your credentials:

```powershell
copy E:\Ai based travel manage ment system\backend\.env.example E:\Ai based travel manage ment system\backend\.env
```

Edit `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=travelmind_ai
```

### 4. Test Database Connection

```powershell
cd E:\Ai based travel manage ment system\backend
npm run test:db
```

Expected output:
```
Testing database connection...
Host: localhost
Port: 3306
Database: travelmind_ai
User: root

Database connected successfully
✓ Database connection test PASSED

Query result: [ { test: 1 } ]

Connection pool closed.
```

### 5. Verify Tables

```sql
USE travelmind_ai;
SHOW TABLES;
SELECT COUNT(*) FROM destinations;
SELECT COUNT(*) FROM travel_packages;
```

Expected:
- 9 tables
- 12 destinations
- 12 travel packages

## Verification Queries

```sql
-- Check all tables exist
SHOW TABLES;

-- Verify destinations
SELECT name, category, estimated_budget FROM destinations ORDER BY id;

-- Verify packages
SELECT tp.name, d.name as destination, tp.price_per_person 
FROM travel_packages tp 
JOIN destinations d ON tp.destination_id = d.id 
ORDER BY tp.id;

-- Verify foreign keys
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'travelmind_ai'
AND REFERENCED_TABLE_NAME IS NOT NULL;
```

## Admin User Provisioning

For security, the seed.sql does not include a default admin with a known password. Provision an admin using a trusted, server-side process:

### Option 1: Using MySQL directly (with bcrypt hash generated offline)
```bash
# Generate bcrypt hash (example using Node.js):
# node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword123', 10))"

# Then in MySQL:
INSERT INTO users (name, email, phone, password_hash, role) VALUES
('Admin User', 'admin@travelmind.ai', '+91 99999 99999', '$2a$10$generated_hash_here', 'admin');
```

### Option 2: Register a user, then promote via SQL
```sql
-- Register normally via API, then promote:
UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
```

### Option 3: Using a one-time backend script (recommended for production)
Create a temporary script in `backend/scripts/create-admin.js`:
```javascript
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const config = require('../config');

async function createAdmin() {
  const passwordHash = await bcrypt.hash('YourStrongPassword123', config.bcrypt.saltRounds);
  await pool.execute(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    ['Admin', 'admin@travelmind.ai', '+91 99999 99999', passwordHash, 'admin']
  );
  console.log('Admin created');
  await pool.end();
}
createAdmin();
```
Run with: `node backend/scripts/create-admin.js`

**Never** hardcode admin credentials in seed.sql or committed files.

## Notes

- All budgets and prices are in Indian Rupees (INR)
- Preference scores range from 0-100
- JSON columns use MySQL 8+ native JSON type
- Foreign keys use CASCADE DELETE for data integrity
- The admin user in seed.sql has a placeholder bcrypt hash
- Never commit real passwords or API keys to the repository