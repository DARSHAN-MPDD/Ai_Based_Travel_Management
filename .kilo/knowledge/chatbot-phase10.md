# Chatbot Phase 10 Implementation Notes

## Architecture

### Rule-Based Chatbot (no OPENAI_API_KEY required)
- **Service**: `backend/services/chatbotService.js`
- **Controller**: `backend/controllers/chatbotController.js`
- **Routes**: `backend/routes/chatbotRoutes.js` — mounted at `/api/chatbot`
- **Frontend**: `frontend/chatbot.html`, `frontend/js/chatbot.js`, `frontend/css/chatbot.css`

### Key Components
1. **Intent Classification** (`classifyIntent`): Pattern-matches normalized text against intent keywords
2. **Entity Extraction**: `extractBudget`, `extractDuration`, `extractLocation`, `extractInterest`, `extractDestinationName`
3. **Intent Handlers**: `handleDestinationSearch`, `handleDestinationDetails`, `handleBudgetPlanning`, `handleBudgetItinerary`, `handleRecommendations`, `handleBookingStatus`, `handleReviewSummary`
4. **Response Building**: `buildIntentReply` — converts handler results into human-readable replies
5. **Session Management**: In-memory `Map` (`sessionStore`) with session ownership enforced via `req.user.id`

## Authentication
- Routes use `optionalAuth` middleware (not `authenticateToken`) — allows both authenticated and anonymous chat
- When authenticated, `req.user = { id, role }` is set from JWT; sessions are tied to user ID
- Session ownership is enforced: `getSession(sessionId, userId)` returns `null` if `session.userId !== userId`
- Booking/recommendation/preference handlers check `userId` and return auth prompt if null

## Known Issues & Fixes Applied

### 1. extractBudget false-positive on duration numbers
**Problem**: `extractBudget("Help me plan a trip for 3 days")` returned `3` (from "3 days"), causing the itinerary handler to be triggered with a nonsensical budget.
**Fix**: Changed minimum threshold from `value > 0` to `value > 100` in the first regex pattern, consistent with the second pattern's threshold.

### 2. handleBudgetItinerary nested result structure
**Problem**: `handleBudgetItinerary` returned data nested under `result.result`, but `buildIntentReply` destructures from `result` directly (expecting `result.destination`, `result.itinerary`, etc.).
**Fix**: Flattened the return value so `destination`, `itinerary`, `budget`, `duration`, `message` are at the top level.

### 3. Session ownership not enforced (no auth middleware)
**Problem**: Chatbot routes lacked `optionalAuth` middleware, so `req.user` was always `undefined`. Sessions were created with `userId: null`, and the ownership check (`null !== null`) always passed.
**Fix**: Added `optionalAuth` middleware to all three chatbot routes (POST/message, GET/session, DELETE/session).

### 4. getBudgetRecommendations returned wrong destination
**Problem**: `ORDER BY estimated_budget ASC` returned the cheapest destination first. Test destination (₹8,000) and Gokarna (₹8,000) had the same budget, but Gokarna had a lower ID and appeared first.
**Fix**: Changed ordering to `ORDER BY ABS(estimated_budget - ?), id DESC` — prefers destinations closest to 80% of user's budget, with newer destinations as tiebreaker.

## Session Store
- **Type**: In-memory `Map` (data lost on server restart)
- **Session ID format**: `chat_<timestamp>_<random5>`
- **Max history**: 20 messages per session
- **Max message length**: 2000 characters
