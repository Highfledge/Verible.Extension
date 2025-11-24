# Risk Level Classification Fix

## Issue
A pulse score of 56/100 was being incorrectly classified. The frontend was calculating its own risk level instead of using the backend's classification.

## Root Cause
The frontend was **calculating risk levels** using hardcoded thresholds:
- `>= 75` = "Trusted"
- `>= 45` = "Uncertain"  
- `< 45` = "Avoid"

However, the **backend API can send its own `riskLevel`** in the response, which may use different thresholds or logic. The frontend was ignoring this and always calculating its own.

## Solution
Updated the code to:
1. **Extract `riskLevel` from backend response** if available
2. **Use backend's `riskLevel`** instead of calculating
3. **Only calculate as fallback** if backend doesn't provide it

## Changes Made

### 1. Background Script (`entrypoints/background.ts`)
- **Lines 482-489**: Extract `riskLevel` from cached data
- **Lines 556-564**: Extract `riskLevel` from API response
- **Color determination**: Now uses `riskLevel` to determine badge color instead of just pulse score

### 2. Content Script (`entrypoints/content.ts`)
- **Line 506**: Updated to use backend's `riskLevel` if available

## Code Changes

### Before:
```typescript
// Only extracted pulseScore, calculated riskLevel
const pulseScore = scoreResponse.data.scoringResult?.pulseScore;
const riskLevel = pulseScore >= 75 ? 'Trusted' : pulseScore >= 45 ? 'Uncertain' : 'Avoid';
```

### After:
```typescript
// Extract riskLevel from backend if available
const riskLevel = scoreResponse.data.scoringResult?.riskLevel || 
                 scoreResponse.data.riskLevel ||
                 (pulseScore >= 75 ? 'Trusted' : pulseScore >= 45 ? 'Uncertain' : 'Avoid');
```

## Where Classification Happens

### Backend (API Response)
- The backend can send `riskLevel` in:
  - `data.scoringResult.riskLevel`
  - `data.riskLevel`
- Backend may use different thresholds or logic

### Frontend (Fallback)
- Only calculates if backend doesn't provide `riskLevel`
- Uses thresholds: `>= 75` (Trusted), `>= 45` (Uncertain), `< 45` (Avoid)

## Testing

To verify the fix:
1. Check API response - does it include `riskLevel`?
2. If yes, frontend will use it
3. If no, frontend calculates using thresholds

## Note on "Very High"
If you're seeing "very high" classification, it might be:
- **Confidence Level**: `confidenceLevel: "high"` (not risk level)
- **Backend Classification**: Backend might be sending a different risk level value
- **Display Issue**: Check where "very high" is being displayed

## Next Steps

1. **Check Backend Response**: Verify what `riskLevel` the backend sends for a score of 56
2. **Verify Display**: Check where "very high" is being shown - might be confidence level, not risk level
3. **Backend Thresholds**: If backend uses different thresholds, they will now be respected

