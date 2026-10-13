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
- **File**: `backend/controllers/re-reviewController.js`
- **Issue**: `getReviewById` was defined but never used in routes. It also returned a plain object instead of sending an HTTP response.
- **Fix**: Converted `getReviewById` to send a proper JSON HTTP response. (Note: This function is still not wired to a route; it remains available for future use.)

## Known Issues

None remaining after Phase 13 fixes.