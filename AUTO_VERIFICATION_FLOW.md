# Auto-Verification Flow - Seller Page Detection & Analysis

## Overview

This document explains how the Verible extension automatically detects and analyzes sellers when a user visits a seller profile page on supported marketplaces.

## Flow Diagram

```
User visits seller page
    ↓
Content Script (content.ts) detects seller profile URL
    ↓
Shows loading badge on page
    ↓
Sends DETECT_SELLER_PAGE message to background script
    ↓
Background Script (background.ts) receives message
    ↓
Calls API: POST /api/sellers/score-by-url
    ↓
Updates extension badge with trust score
    ↓
Stores seller data in browser storage
    ↓
Content script updates page badge with results
```

## Key Files & Components

### 1. Content Script (`entrypoints/content.ts`)

**Purpose**: Runs on marketplace pages, detects seller profile pages, and triggers analysis.

**Key Functions**:

#### `initializeVerible()` (Line 58)
- Entry point when content script loads
- Detects marketplace platform
- Checks if current URL matches seller profile patterns
- Triggers analysis if seller page detected

**Seller Profile Detection** (Lines 73-89):
```typescript
const sellerProfilePatterns = [
  /jiji\.ng\/sellerpage/,
  /jiji\.ng\/shop/,
  /facebook\.com\/marketplace\/profile/,
  /etsy\.com\/shop\/[^\/\?\s]+/,
  /ebay\.com\/str\/[^\/\?]+/,
  // ... more patterns
];
```

**Auto-Verification Trigger** (Lines 117-147):
```typescript
if (isSellerProfile) {
  // Show loading badge
  showVeribleBadge(currentUrl, true);
  
  // Send message to background script
  runtime.sendMessage({
    type: 'DETECT_SELLER_PAGE',
    data: { profileUrl: currentUrl, platform }
  })
  .then((response) => {
    // Update badge with results
    showVeribleBadge(currentUrl, false, response.data);
  });
}
```

**Key Functions**:
- `detectMarketplace()` - Identifies which marketplace (Facebook, Jiji, eBay, etc.)
- `showVeribleBadge()` - Displays badge/toast on the page
- `removeVeribleBadge()` - Removes badge when leaving seller page

### 2. Background Script (`entrypoints/background.ts`)

**Purpose**: Handles API calls and updates extension badge.

**Key Handler**: `handleSellerPageDetection()` (Lines 388-509)

**Flow**:
1. Receives `DETECT_SELLER_PAGE` message from content script
2. Shows loading badge (`...`) on extension icon
3. Calls API endpoint: `POST /api/sellers/score-by-url`
4. Extracts `pulseScore`, `confidenceLevel`, `recommendations`, `riskFactors`
5. Updates extension badge with score (color-coded: green/amber/red)
6. Stores seller data in WXT storage for popup access
7. Sends response back to content script

**API Call** (Lines 419-422):
```typescript
const scoreResponse = await makeApiRequest('/api/sellers/score-by-url', {
  method: 'POST',
  body: JSON.stringify({ profileUrl }),
});
```

**Badge Update** (Lines 435-445):
```typescript
if (pulseScore !== undefined && pulseScore !== null) {
  const scoreText = Math.round(pulseScore).toString();
  const color = pulseScore >= 75 ? '#10B981' : 
                pulseScore >= 45 ? '#F59E0B' : '#EF4444';
  
  await action.setBadgeText({ text: scoreText });
  await action.setBadgeBackgroundColor({ color });
}
```

**Storage** (Lines 448-457):
```typescript
await storage.setItem('local:pendingSellerAnalysis', {
  profileUrl,
  pulseScore,
  confidenceLevel,
  recommendations,
  riskFactors,
  profileData: scoreResponse.data.profileData,
  marketplaceData: scoreResponse.data.marketplaceData
});
await storage.setItem('local:openSellerAnalysis', true);
```

### 3. Popup/Dashboard (`entrypoints/popup/components/Dashboard.tsx`)

**Purpose**: Displays seller analysis when user opens extension popup.

**Auto-Detection** (Lines 617-687):
- When dashboard opens, checks if current tab is a seller profile
- If yes, automatically searches/analyzes that seller
- Uses `hasAutoDetectedRef` to prevent duplicate detection

**Pending Analysis** (Lines 14-20):
- Receives `pendingSellerAnalysis` prop from App.tsx
- Displays seller analysis if user clicked badge or opened extension from seller page

### 4. App Component (`entrypoints/popup/App.tsx`)

**Purpose**: Main app router, checks for pending seller analysis.

**Pending Analysis Check** (Lines 33-51):
```typescript
const checkPendingSellerAnalysis = async () => {
  const result = await browser.storage.local.get([
    'pendingSellerAnalysis', 
    'openSellerAnalysis'
  ]);
  
  if (result.openSellerAnalysis && result.pendingSellerAnalysis) {
    setPendingSellerAnalysis(result.pendingSellerAnalysis);
  }
};
```

## Message Flow

### Content Script → Background Script

**Message Type**: `DETECT_SELLER_PAGE`

**Payload**:
```typescript
{
  type: 'DETECT_SELLER_PAGE',
  data: {
    profileUrl: string,  // Current page URL
    platform?: string     // Detected platform (facebook, jiji, etc.)
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  data?: {
    pulseScore: number,
    confidenceLevel: 'high' | 'medium' | 'low',
    recommendations: Array<{...}>,
    riskFactors: Array<{...}>,
    profileData: {...},
    marketplaceData: {...}
  },
  error?: string
}
```

## API Endpoint

**Endpoint**: `POST /api/sellers/score-by-url`

**Request**:
```json
{
  "profileUrl": "https://facebook.com/marketplace/profile/123456"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scoringResult": {
      "pulseScore": 75,
      "confidenceLevel": "high",
      "recommendations": [...],
      "riskFactors": [...]
    },
    "profileData": {...},
    "marketplaceData": {...}
  }
}
```

## Storage Keys

- `local:pendingSellerAnalysis` - Seller data for popup to display
- `local:openSellerAnalysis` - Flag indicating popup should show analysis

## Supported Marketplaces

The extension automatically detects seller pages on:

- **Facebook Marketplace**: `/marketplace/profile/` or `/marketplace/`
- **Jiji.ng**: `/sellerpage/` or `/shop/`
- **eBay**: `/str/` (store) or `/usr/` (user)
- **Etsy**: `/shop/[shopname]`
- **Craigslist**: Listing pages
- **OfferUp**: `/user/` or `/profile/`
- **Jumia**: `/seller/[id]/profile`
- **Konga**: `/merchant/[id]`
- **Kijiji**: `/o-profile/[id]`

## Where to Work on Auto-Verification

### 1. **Improve Seller Page Detection** (`content.ts`)

**Location**: Lines 73-89, 91-97

**Current**: Uses regex patterns to match URLs

**Potential Improvements**:
- Add more marketplace patterns
- Improve pattern matching accuracy
- Handle dynamic URLs (SPA navigation)
- Add DOM-based detection as fallback

### 2. **Enhance API Response Handling** (`background.ts`)

**Location**: Lines 428-471

**Current**: Extracts score and updates badge

**Potential Improvements**:
- Better error handling
- Retry logic for failed requests
- Caching to avoid duplicate API calls
- Rate limiting

### 3. **Improve Badge Display** (`content.ts`)

**Location**: Lines 534-744 (`showVeribleBadge` function)

**Current**: Shows badge with score and message

**Potential Improvements**:
- Better positioning
- Animation improvements
- More detailed information
- Click-to-expand functionality

### 4. **Add Auto-Refresh** (`content.ts`)

**Location**: After line 147

**Potential Addition**:
- Monitor URL changes (for SPA navigation)
- Re-trigger analysis when navigating to different seller
- Debounce to avoid excessive API calls

### 5. **Enhance Dashboard Auto-Detection** (`Dashboard.tsx`)

**Location**: Lines 617-687

**Current**: Auto-detects seller when dashboard opens

**Potential Improvements**:
- Better URL pattern matching
- Handle edge cases
- Show loading state during detection
- Cache detection results

## Testing Auto-Verification

1. **Load extension in development mode**
2. **Navigate to a seller profile page** (e.g., `facebook.com/marketplace/profile/123`)
3. **Check browser console** for logs:
   - "Verible: Detected seller profile page"
   - "Verible: Background script response"
4. **Verify extension badge** shows trust score
5. **Check page badge** appears with analysis
6. **Open extension popup** - should show seller analysis

## Debugging

### Enable Debug Logs

All components log to browser console:
- Content script: `console.log('Verible: ...')`
- Background script: `console.log('Verible: ...')`

### Common Issues

1. **Badge not updating**: Check background script console
2. **API call failing**: Check network tab, verify API endpoint
3. **Pattern not matching**: Add console.log to see URL being tested
4. **Storage not working**: Check browser storage permissions

## Next Steps for Enhancement

1. **Add URL change detection** for single-page apps
2. **Implement caching** to reduce API calls
3. **Add retry logic** for failed requests
4. **Improve error messages** for users
5. **Add analytics** to track detection success rate
6. **Support more marketplaces** by adding patterns

