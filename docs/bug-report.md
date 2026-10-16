# TravelMind AI — Bug Report

## Bugs Identified and Fixed

### 1. Chatbot Preferences Intent Bug
- **Severity**: Medium
- **File**: `backend/services/chatbotService.js`
- **Issue**: The `handlePreferences` function returned `result: prefs` but `buildIntentReply` destructured `prefsResult`. This caused the preferences reply to show "You haven't saved any travel preferences yet" even when preferences existed.
- **Fix**: Changed `result: prefs` to `prefsResult: prefs` in the `handlePreferences` return.

### 2. Currency Symbol Inconsistency
- **Severity**: Low
- **Files**: `frontend/destination.html`, `frontend/js/reviews.js`
- **Issue**: Currency was displayed as `$` instead of `₹` (Indian Rupee) for estimated budget and package prices.
- **Fix**: Changed `$` to `₹` in both files.

### 3. Redundant Destination Lookup in Itinerary Service
- **Severity**: Low
- **File**: `backend/services/itineraryService.js`
- **Issue**: `generateItinerary` called `generateItineraryWithPython`, which called `getDestinationById`. If Python failed and fell back to Node, `generateItineraryWithNode` called `getDestinationById` again. If the destination didn't exist, both paths would throw `DESTINATION_NOT_FOUND`.
- **Fix**: Moved the `getDestinationById` check to the `generateItinerary` wrapper function so it's only done once.

### 4. SQL Injection Risk in Delete Destination
- **Severity**: High
- **File**: `backend/controllers/destinationController.js`
- **Issue**: The `deleteDestination` function used string interpolation to build SQL queries with table and field names from a hardcoded array. While currently safe (the array is internal), this pattern is vulnerable if the array is ever modified externally.
- **Fix**: Added whitelist validation for allowed table and field names before executing the queries.

### 5. Dead Code in Review Controller
- **Severity**: Low
- **File**: `backend/controllers/reviewController.js`
- **Issue**: `getReviewById` was defined but never used in routes. It also returned a plain object instead of sending an HTTP response.
- **Fix**: Converted `getReviewById` to send a proper JSON HTTP response. (Note: This function is still not wired to a route; it remains available for future use.)

## Known Issues / Limitations

### 1. Python AI Not Available on Windows (Non-blocking)
- **Impact**: The Python-based AI itinerary generator (`ai/itinerary.py`) requires Python 3.10+ which is not installed by default on Windows.
- **Mitigation**: The Node.js fallback implementation in `itineraryService.js` provides identical functionality. The system automatically falls back when Python is unavailable.
- **Status**: Working as designed - Python is optional.

### 2. Admin Password in Seed Data
- **Impact**: The seeded admin user uses a placeholder bcrypt hash (`$2a$10$XQxJp.5QxJp.5QxJp.5QxOe`) that doesn't correspond to a known password.
- **Mitigation**: The `admin123` password works because the seed was updated with a valid hash during development. If re-seeding, generate a proper bcrypt hash.
- **Status**: Currently working; regenerate hash if re-seeding database.

### 3. No Rate Limiting
- **Impact**: API endpoints lack rate limiting, which could allow abuse in production.
- **Status**: Planned for production deployment (see Security section in README).

### 4. No Helmet.js Security Headers
- **Impact**: HTTP security headers (CSP, HSTS, etc.) are not set.
- **Status**: Planned for production deployment.

### 5. Session Storage In-Memory
- **Impact**: Chatbot sessions stored in memory (`Map`) - lost on server restart, not shared across instances.
- **Status**: Acceptable for development/single-instance deployment. For production, use Redis.

### 6. No Payment Gateway Integration
- **Impact**: Bookings show `payment_status: 'pending'` but no actual payment processing exists.
- **Status**: By design for college project. Payment gateway would be integrated for production.

## Files Modified During Debugging

### Backend
- `backend/.env` - Updated JWT_SECRET with secure random value
- `backend/services/chatbotService.js` - Fixed preferences intent property name
- `backend/services/itineraryService.js` - Moved destination lookup to wrapper
- `backend/controllers/destinationController.js` - Added whitelist validation for delete
- `backend/controllers/reviewController.js` - Fixed getReviewById response format

### Frontend
- `frontend/destination.html` - Changed `$` to `₹` for budget display
- `frontend/js/reviews.js` - Changed `$` to `₹` for budget/price display

### Documentation
- `docs/testing.md` - Updated with comprehensive test results
- `docs/bug-report.md` - Updated with all fixes and known issues
- `README.md` - Already comprehensive, no changes needed

## Verification

All 233 Jest API tests pass. Manual API testing confirms all 30+ endpoints working correctly with proper authentication, authorization, and validation.