# Marketplace Data Display for Insufficient Scoring Data

## Overview
When the backend returns insufficient data for scoring (especially common on eBay), the extension now displays available marketplace metrics instead of showing an error. This helps buyers make informed decisions even when a trust score cannot be calculated.

## Problem
For some sellers (especially on eBay), the API returns:
```json
{
  "success": true,
  "message": "Profile extracted but insufficient data for scoring",
  "data": {
    "scoringResult": {
      "status": "insufficient_data",
      "message": "Not Enough Data"
    },
    "extractedData": {
      "marketplaceData": {
        "avgRating": 4.95,
        "followers": 63000,
        "successfulSales": 880000,
        "verificationStatus": "trusted"
      },
      "sellerMetrics": {
        "positiveFeedbackPercent": 99,
        "itemsSold": 880000
      }
    }
  }
}
```

Previously, this would show "N/A" or an error, hiding valuable marketplace data.

## Solution
The extension now:
1. **Detects insufficient data** when `scoringResult.status === "insufficient_data"` or `pulseScore` is null
2. **Extracts marketplace metrics** from `extractedData.marketplaceData` and `extractedData.sellerMetrics`
3. **Displays metrics in badge** showing ratings, sales, followers, verification status
4. **Makes platform clear** (e.g., "eBay Seller Data")
5. **Allows users to proceed** with the information available

## Changes Made

### 1. Background Script (`entrypoints/background.ts`)

#### Detection Logic (Lines 567-590)
- Checks for `scoringStatus === 'insufficient_data'`
- Extracts `marketplaceData`, `sellerMetrics`, `profileData`
- Determines if marketplace data is available

#### Badge Display (Lines 625-660)
- Shows "?" badge when marketplace data available but no score
- Sets badge title: "Marketplace data available - Click to view details"

#### Data Storage (Lines 594-603, 640-655)
- Stores marketplace data even when score is unavailable
- Includes `scoringStatus`, `hasMarketplaceData` flag
- Stores platform name for display

### 2. Content Script (`entrypoints/content.ts`)

#### Badge Display (Lines 624-720)
- Detects `hasMarketplaceData` or `scoringStatus === 'insufficient_data'`
- Builds marketplace metrics display:
  - ⭐ Rating (e.g., "4.95 rating")
  - 👍 Positive feedback percentage
  - 📦 Sales count (formatted: 880K, 1.2M)
  - 👥 Followers (formatted: 63K, 1.2M)
  - ✓ Verification status
- Shows platform name (e.g., "eBay Seller Data")
- Clear message: "Score unavailable - marketplace metrics shown"

## Display Format

### When Score Available:
```
[Score Badge] Trust Score: 75/100
              Highly trustworthy seller
```

### When Score Unavailable but Marketplace Data Available:
```
[? Badge]     eBay Seller Data
              Score unavailable - marketplace metrics shown
              
              ⭐ 4.95 rating  👍 99% positive  📦 880K sales  👥 63K followers  ✓ trusted
              
              Click to view eBay metrics
```

## Marketplace Metrics Displayed

1. **Average Rating** (`avgRating`)
   - Format: "⭐ 4.95 rating"
   - Only shown if > 0

2. **Positive Feedback** (`positiveFeedbackPercent`)
   - Format: "👍 99% positive"
   - From `sellerMetrics.positiveFeedbackPercent`

3. **Sales Count** (`successfulSales` or `itemsSold`)
   - Format: "📦 880K sales" or "📦 1.2M sales"
   - Automatically formats large numbers (K, M)

4. **Followers** (`followers`)
   - Format: "👥 63K followers" or "👥 1.2M followers"
   - Automatically formats large numbers

5. **Verification Status** (`verificationStatus`)
   - Format: "✓ trusted" or "✓ verified"
   - Only shown if not "unverified"

## Platform Support

Currently optimized for:
- **eBay**: Most common case for insufficient data
- **Other platforms**: Will show marketplace data if available

Platform name is automatically capitalized and displayed (e.g., "eBay", "Etsy", "Jiji").

## User Experience

### Before:
- ❌ Shows "N/A" or error
- ❌ No useful information
- ❌ User can't make informed decision

### After:
- ✅ Shows marketplace metrics
- ✅ Clear indication data is from platform
- ✅ User can see ratings, sales, verification
- ✅ Can proceed with informed decision

## Technical Details

### Data Extraction
```typescript
const extractedData = scoreResponse.data.extractedData;
const marketplaceData = extractedData?.marketplaceData;
const sellerMetrics = extractedData?.sellerMetrics;
const platform = extractedData?.platform || 'unknown';
```

### Insufficient Data Detection
```typescript
const hasInsufficientData = scoringStatus === 'insufficient_data' || 
                            (pulseScore === undefined && pulseScore === null);
const hasMarketplaceData = marketplaceData && (
  marketplaceData.avgRating > 0 ||
  marketplaceData.followers > 0 ||
  marketplaceData.successfulSales > 0 ||
  sellerMetrics?.itemsSold > 0
);
```

### Number Formatting
- Numbers >= 1,000,000: Display as "X.XM"
- Numbers >= 1,000: Display as "X.XK"
- Numbers < 1,000: Display as-is

## Testing

To test this feature:
1. Visit an eBay seller page that returns insufficient data
2. Verify badge shows "?" with marketplace metrics
3. Check that metrics are formatted correctly
4. Verify platform name is displayed
5. Click badge to open extension popup
6. Verify marketplace data is shown in popup

## Future Enhancements

1. **More platforms**: Add specific handling for other marketplaces
2. **Metric comparisons**: Compare seller metrics to platform averages
3. **Historical trends**: Show if metrics are improving/declining
4. **Recommendations**: Provide guidance based on marketplace metrics
5. **Export data**: Allow users to export marketplace metrics

