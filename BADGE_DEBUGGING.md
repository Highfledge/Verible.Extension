# Badge Notification Debugging Guide

## Issue: Badge Not Showing on Seller Pages

### Quick Test

1. **Open browser console** (F12 → Console tab)
2. **Check background script logs:**
   - Go to `chrome://extensions/` (or `about:debugging` for Firefox)
   - Find your extension
   - Click "Inspect views: background page" or "service worker"
   - Check console for initialization messages

3. **Test badge API manually:**
   ```javascript
   // In background script console:
   chrome.runtime.sendMessage({
     type: 'TEST_BADGE',
     data: { pulseScore: 75, profileUrl: 'https://test.com/seller' }
   });
   ```

### Common Issues & Solutions

#### 1. Badge API Not Available
**Symptoms:** Console shows "Badge API not available"

**Solution:**
- Check if extension has proper permissions
- Verify WXT framework is properly configured
- Try rebuilding: `npm run build`

#### 2. User Not Authenticated
**Symptoms:** Badge shows "?" instead of score

**Solution:**
- Sign in to the extension
- Check if auth token is stored: `chrome.storage.local.get(['authToken'])`

#### 3. Tab Listener Not Firing
**Symptoms:** No console logs when navigating to seller page

**Solution:**
- Check if URL matches seller profile patterns
- Verify content script is loaded (check page console)
- Check background script console for tab update logs

#### 4. Content Script Not Sending Message
**Symptoms:** Background script doesn't receive DETECT_SELLER_PAGE message

**Solution:**
- Check page console for "Verible: Detected seller profile page" message
- Verify content script matches are correct in manifest
- Check if content script is blocked by page

#### 5. API Request Failing
**Symptoms:** Badge shows loading but never updates

**Solution:**
- Check background script console for API errors
- Verify network connectivity
- Check if API endpoint is accessible
- Verify auth token is valid

### Debugging Steps

1. **Check Background Script:**
   ```
   - Open chrome://extensions/
   - Find Verible extension
   - Click "Inspect views: service worker" (or background page)
   - Look for initialization logs
   - Check for any errors
   ```

2. **Check Content Script:**
   ```
   - Open seller page (e.g., https://jiji.ng/sellerpage-...)
   - Open DevTools (F12)
   - Check Console tab
   - Look for "Verible: Content script loaded" message
   - Look for "Verible: Detected seller profile page" message
   ```

3. **Check Tab Updates:**
   ```
   - In background script console
   - Navigate to seller page
   - Should see "Tab updated" log
   - Should see "Is seller profile: true" log
   ```

4. **Check Badge API:**
   ```
   - In background script console
   - Should see "Badge API test successful" on startup
   - If not, badge API is not available
   ```

5. **Manual Badge Test:**
   ```
   - In background script console, run:
   chrome.action.setBadgeText({ text: '75' });
   chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
   - If this works, badge API is functional
   - If not, there's a permission or API issue
   ```

### Expected Console Output

**Background Script (on load):**
```
Verible: Background script loaded { id: "..." }
Verible: Initializing badge system...
Browser API available: true
Action API available: true
Tabs API available: true
Testing badge API...
Badge API test successful
```

**When visiting seller page:**
```
Tab updated: { tabId: ..., url: "https://jiji.ng/sellerpage-...", status: "complete" }
Is seller profile: true URL: https://jiji.ng/sellerpage-...
Verible: Detected seller profile page: https://jiji.ng/sellerpage-...
handleSellerPageDetection called with: { profileUrl: "https://..." }
Setting loading badge for: https://...
User authenticated, extracting seller profile...
Extract response: { success: true, data: {...} }
Seller data extracted: { pulseScore: 75, sellerId: "...", sellerName: "..." }
Updating badge with pulse score: 75
Setting badge: { scoreText: "75", color: "#10B981", riskLevel: "Trusted" }
Badge updated successfully: 75
```

### URL Pattern Matching

The extension detects these seller profile patterns:
- `jiji.ng/sellerpage*`
- `jiji.ng/shop*`
- `facebook.com/marketplace/profile*`
- `facebook.com/*/marketplace*`
- `etsy.com/shop*`
- `craigslist.org/*/*.html`
- `offerup.com/user*`
- `offerup.com/profile*`

If your URL doesn't match these patterns, the badge won't show.

### Color Coding

- **Green (#10B981)**: Score ≥ 75 (Trusted)
- **Amber (#F59E0B)**: Score 45-74 (Uncertain)  
- **Red (#EF4444)**: Score < 45 (Avoid)

### Still Not Working?

1. Rebuild the extension: `npm run build`
2. Reload the extension in browser
3. Clear browser cache
4. Check all console logs (background + content + page)
5. Verify you're signed in to the extension
6. Test with a known seller URL that matches the patterns

