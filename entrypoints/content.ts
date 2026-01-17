// Declare browser API for WXT framework
declare const browser: any;
declare const chrome: any;

// Get browser runtime API (handles both Chrome and Firefox)
function getRuntimeAPI() {
  // Try globalThis.chrome first (most reliable)
  const chromeGlobal = (globalThis as any).chrome;
  if (chromeGlobal && chromeGlobal.runtime) {
    return chromeGlobal.runtime;
  }
  // Try browser.runtime (Firefox/standard)
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser.runtime;
  }
  // Fallback to chrome.runtime (Chrome)
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  }
  console.error('Runtime API not available');
  return null;
}

// Configuration constants
const CONFIG = {
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  URL_CHECK_INTERVAL_SELLER: 500, // 500ms for seller profiles
  URL_CHECK_INTERVAL_GENERAL: 1000, // 1 second for general pages
  MIN_INITIALIZATION_INTERVAL: 300, // Minimum 300ms between initializations
  API_TIMEOUT: 30000, // 30 second timeout
  RETRY_DELAY: 1000, // 1 second base delay
  MAX_RETRIES: 3,
  DEBOUNCE_DELAY: 300, // 300ms debounce
  MUTATION_CHECK_DELAY: 100 // 100ms delay for DOM changes
} as const;

// Cache for seller analysis results (reduces API calls)
const analysisCache = new Map<string, {
  data: any;
  timestamp: number;
  expiresAt: number;
}>();

// Debounce timer for URL changes
let urlChangeDebounceTimer: number | null = null;
let lastProcessedUrl = '';
// Track initialization state to prevent race conditions
let isInitializing = false;
let pendingRequests = new Map<string, Promise<any>>();
let lastInitializationTime = 0;
// Minimum 300ms between initializations

function detectMarketplaceFromUrl(): string {
  const host = window.location.hostname.toLowerCase();

  if (host.includes('etsy.com')) return 'etsy';
  if (host.includes('ebay.com')) return 'ebay';
  if (host.includes('jiji')) return 'jiji';
  if (host.includes('jumia')) return 'jumia';
  if (host.includes('konga')) return 'konga';
  if (host.includes('kijiji')) return 'kijiji';

  return 'unknown';
}

export default defineContentScript({
  matches: [
    '*://*.jiji.ng/*',
    '*://*.ebay.com/*',
    '*://*.etsy.com/*',
    '*://*.jumia.com.ng/*',
    '*://*.jumia.com/*',
    '*://*.konga.com/*',
    '*://*.kijiji.ca/*',
    '*://*.kijiji.com/*'
  ],
  main() {
    console.log('Verible: Content script loaded on marketplace page');
    
    // Check if runtime API is available
    const runtime = getRuntimeAPI();
    if (!runtime) {
      console.error('Verible: Runtime API not available - content script may not work correctly');
    } else {
      console.log('Verible: Runtime API available');
    }
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeVerible);
    } else {
      initializeVerible();
    }
    
    // Monitor URL changes for SPA navigation
    setupUrlChangeMonitoring();
  },
});

// Setup URL change monitoring for SPA navigation
function setupUrlChangeMonitoring() {
  let lastUrl = window.location.href;
  let lastSellerProfileUrl = '';

  // Helper function to check if current URL is a seller profile
  const isCurrentUrlSellerProfile = () => {
    const currentUrl = window.location.href;
    const sellerProfilePatterns = [
      // Jiji patterns
      /jiji\.ng\/sellerpage\/[^\/\?\s]+/i,
      /jiji\.ng\/shop\/[^\/\?\s]+/i,
      // Etsy patterns
      /etsy\.com\/shop\/[^\/\?\s]+/i,
      // eBay patterns
      /ebay\.com\/str\/[^\/\?\s]+/i,
      /ebay\.com\/usr\/[^\/\?\s]+/i,
      // Jumia patterns
      /jumia\.com\.ng\/seller\/[^\/]+\/profile/i,
      /jumia\.com\/seller\/[^\/]+\/profile/i,
      // Konga patterns
      /konga\.com\/merchant\/[^\/\?\s]+/i,
      // Kijiji patterns
      /kijiji\.ca\/o-profile\/[^\/\?\s]+/i,
      /kijiji\.com\/o-profile\/[^\/\?\s]+/i
    ];

    return sellerProfilePatterns.some(pattern => pattern.test(currentUrl));
  };

  // Enhanced URL change detection for seller profiles
  const checkUrlChange = () => {
    const currentUrl = window.location.href;
    const currentIsSellerProfile = isCurrentUrlSellerProfile();

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('Verible: URL changed:', currentUrl);

      // Special handling for seller profile transitions
      if (currentIsSellerProfile) {
        // If we're moving to a different seller profile, trigger immediately
        if (lastSellerProfileUrl !== currentUrl) {
          console.log('Verible: Detected seller profile transition:', {
            from: lastSellerProfileUrl,
            to: currentUrl
          });
          lastSellerProfileUrl = currentUrl;

          // Clear any pending initialization
          isInitializing = false;
          if (urlChangeDebounceTimer) {
            clearTimeout(urlChangeDebounceTimer);
          }

          // Trigger initialization immediately for seller profiles
          lastProcessedUrl = currentUrl;
          initializeVerible();
          return;
        }
      } else {
        // For non-seller pages, clear the last seller profile URL
        lastSellerProfileUrl = '';
      }

      // For other URL changes, use debounce
      if (urlChangeDebounceTimer) {
        clearTimeout(urlChangeDebounceTimer);
      }

      urlChangeDebounceTimer = window.setTimeout(() => {
        if (currentUrl !== lastProcessedUrl) {
          lastProcessedUrl = currentUrl;
          // Clear any pending initialization flag when URL actually changes
          isInitializing = false;
          initializeVerible();
        }
      }, CONFIG.DEBOUNCE_DELAY);
    } else if (currentIsSellerProfile && lastSellerProfileUrl !== currentUrl) {
      // Handle cases where URL stays the same but content changes (some SPAs)
      console.log('Verible: Content changed within same URL, checking seller profile:', currentUrl);
      lastSellerProfileUrl = currentUrl;
      isInitializing = false;
      lastProcessedUrl = currentUrl;
      initializeVerible();
    }
  };

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', checkUrlChange);

  // Monitor DOM changes that might indicate navigation
  let mutationObserver: MutationObserver | null = null;

  const setupMutationObserver = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      let significantChange = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if added nodes suggest a new page or seller content
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i] as HTMLElement;
            if (node && (node.nodeType === Node.ELEMENT_NODE)) {
              // More comprehensive seller profile detection
              if (node.tagName === 'MAIN' || node.tagName === 'ARTICLE' ||
                  node.classList?.contains('page-content') ||
                  node.classList?.contains('seller-profile') ||
                  node.classList?.contains('shop-content') ||
                  node.classList?.contains('store-content') ||
                  node.classList?.contains('profile-content') ||
                  node.classList?.contains('merchant-content') ||
                  node.id?.includes('seller') ||
                  node.id?.includes('shop') ||
                  node.id?.includes('profile') ||
                  node.id?.includes('store')) {
                significantChange = true;
                break;
              }
            }
          }
          if (significantChange) break;
        }
      }

      if (significantChange) {
        // Small delay to let content settle
        setTimeout(checkUrlChange, CONFIG.MUTATION_CHECK_DELAY);
      }
    });

    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: false // Only observe direct children, not all descendants
      });
    }
  };

  // Setup observer when DOM is ready
  if (document.body) {
    setupMutationObserver();
  } else {
    // Wait for body if not ready
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        setupMutationObserver();
        bodyObserver.disconnect();
      }
    });
    bodyObserver.observe(document.documentElement, {
      childList: true
    });
  }

  // More frequent checking for seller profiles
  setInterval(() => {
    if (isCurrentUrlSellerProfile()) {
      checkUrlChange();
    }
  }, CONFIG.URL_CHECK_INTERVAL_SELLER);

  // General URL checking fallback (less frequent)
  setInterval(() => {
    if (!isCurrentUrlSellerProfile()) {
      checkUrlChange();
    }
  }, CONFIG.URL_CHECK_INTERVAL_GENERAL);
}

function initializeVerible() {
  const currentUrl = window.location.href;
  const now = Date.now();
  
  // Prevent rapid successive calls (rate limiting)
  if (now - lastInitializationTime < CONFIG.MIN_INITIALIZATION_INTERVAL && currentUrl === lastProcessedUrl) {
    console.log('Verible: Skipping initialization - too soon after last call for same URL');
    return;
  }
  
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    console.log('Verible: Initialization already in progress, skipping duplicate call');
    return;
  }
  
  // Check if there's already a pending request for this URL
  if (pendingRequests.has(currentUrl)) {
    console.log('Verible: Request already pending for this URL:', currentUrl);
    return;
  }
  
  isInitializing = true;
  lastInitializationTime = now;
  
  try {
    // Detect which marketplace we're on
    const platform = detectMarketplace();
    if (!platform) {
      console.log('Verible: No marketplace detected for:', window.location.href);
      removeVeribleBadge();
      return;
    }

    console.log(`Verible: Detected ${platform} marketplace on:`, window.location.href);

    // Clear any pending requests from previous URLs to prevent conflicts
    for (const [url, promise] of pendingRequests.entries()) {
      if (url !== currentUrl) {
        console.log('Verible: Cleaning up pending request for different URL:', url);
        // Don't cancel the promise, just remove it from tracking
        pendingRequests.delete(url);
      }
    }

    // Always clear existing badge when initializing (important for seller profile transitions)
    removeVeribleBadge();
    
    // Check if current page is a seller profile page
    const currentPath = window.location.pathname;
  
  // Improved patterns for supported marketplaces only
  const sellerProfilePatterns = [
    // Jiji patterns
    /jiji\.ng\/sellerpage\/[^\/\?\s]+/i,
    /jiji\.ng\/shop\/[^\/\?\s]+/i,
    // Etsy patterns
    /etsy\.com\/shop\/[^\/\?\s]+/i,  // Etsy shop pages
    // eBay patterns
    /ebay\.com\/str\/[^\/\?\s]+/i,  // eBay store pages
    /ebay\.com\/usr\/[^\/\?\s]+/i,  // eBay user pages
    // Jumia patterns
    /jumia\.com\.ng\/seller\/[^\/]+\/profile/i,
    /jumia\.com\/seller\/[^\/]+\/profile/i,
    // Konga patterns
    /konga\.com\/merchant\/[^\/\?\s]+/i,
    // Kijiji patterns
    /kijiji\.ca\/o-profile\/[^\/\?\s]+/i,
    /kijiji\.com\/o-profile\/[^\/\?\s]+/i
  ];

  const isSellerProfile = sellerProfilePatterns.some(pattern => {
    const matches = pattern.test(currentUrl);
    if (matches) {
      console.log('Verible: Pattern matched:', pattern.toString());
    }
    return matches;
  });
  
  console.log('Verible: URL check:', { 
    currentUrl, 
    isSellerProfile, 
    platform,
    pathname: currentPath,
    patternsTested: sellerProfilePatterns.length
  });

  // For eBay specifically, check if we're on homepage or just / (should not show badge)
  if (platform === 'ebay') {
    const isEbayHomepage = currentPath === '/' || currentPath === '' || currentPath.match(/^\/$/);
    if (isEbayHomepage || !isSellerProfile) {
      console.log('Verible: On eBay but not on seller profile page');
      // Show helpful message instead of badge
      showEbayHelperMessage();
      return;
    }
  }

    // Notify background script about seller page detection
    if (isSellerProfile) {
      console.log('Verible: Detected seller profile page, notifying background script:', currentUrl);
      
      // Always remove existing badge first when navigating to new seller
      removeVeribleBadge();
      
      // Check cache first (fast path)
      const cached = getCachedAnalysis(currentUrl);
      if (cached) {
        console.log('Verible: Using cached analysis result');
        showVeribleBadge(currentUrl, false, cached.data);
        isInitializing = false;
        return;
      }
      
      // OPTIMIZATION: Start API call immediately, show badge in parallel
      const runtime = getRuntimeAPI();
      if (!runtime) {
        console.error('Verible: Cannot send message - runtime API not available');
        showVeribleBadge(currentUrl, false, null, 'Extension error');
        isInitializing = false;
        return;
      }
      
      // Create a promise to track this request
      const requestPromise = (async () => {
        try {
          // Show loading badge immediately
          showVeribleBadge(currentUrl, true); // true = loading state
          
          // Send message with timeout and retry logic
          const response = await sendMessageWithRetry(runtime, {
            type: 'DETECT_SELLER_PAGE',
            data: { profileUrl: currentUrl, platform }
          }, CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY);
          
          console.log('Verible: Background script response:', response);
          
          if (response && response.success && response.data) {
            // Cache the result
            cacheAnalysis(currentUrl, response.data);
            // Update badge with actual score and message
            showVeribleBadge(currentUrl, false, response.data);
            return response;
          } else {
            // Show error state
            const errorMsg = response?.error || 'Failed to analyze seller';
            console.error('Verible: API call failed:', errorMsg);
            showVeribleBadge(currentUrl, false, null, errorMsg);
            throw new Error(errorMsg);
          }
        } catch (error: any) {
          console.error('Verible: Error notifying background script:', error);
          showVeribleBadge(currentUrl, false, null, 'Seller cannot be analyzed right now: please try again later');
          throw error;
        } finally {
          // Clean up pending request
          pendingRequests.delete(currentUrl);
        }
      })();
      
      // Store the promise to prevent duplicate requests
      pendingRequests.set(currentUrl, requestPromise);
      
      // Don't await - let it run in background
      requestPromise.catch((error) => {
        console.error('Verible: Request promise rejected:', error);
      });
    } else {
      console.log('Verible: Not a seller profile page:', currentUrl);
      // Remove badge if it exists
      removeVeribleBadge();
    }
  } finally {
    isInitializing = false;
  }
}

// Cache management functions
function cacheAnalysis(url: string, data: any) {
  const now = Date.now();
  analysisCache.set(url, {
    data,
    timestamp: now,
    expiresAt: now + CONFIG.CACHE_EXPIRY_MS
  });
  console.log('Verible: Cached analysis for:', url);
}

function getCachedAnalysis(url: string): { data: any; timestamp: number } | null {
  const cached = analysisCache.get(url);
  if (!cached) {
    return null;
  }
  
  const now = Date.now();
  if (now > cached.expiresAt) {
    analysisCache.delete(url);
    console.log('Verible: Cache expired for:', url);
    return null;
  }
  
  return cached;
}

function clearExpiredCache() {
  const now = Date.now();
  for (const [url, cached] of analysisCache.entries()) {
    if (now > cached.expiresAt) {
      analysisCache.delete(url);
    }
  }
}

// Clean expired cache every minute
const cacheCleanupInterval = setInterval(clearExpiredCache, 60 * 1000);

// Cleanup function for when the content script is unloaded
function cleanup() {
  // Clear all timers
  if (urlChangeDebounceTimer) {
    clearTimeout(urlChangeDebounceTimer);
  }
  clearInterval(cacheCleanupInterval);

  // Clear all caches
  analysisCache.clear();
  pendingRequests.clear();

  // Remove any remaining badges
  removeVeribleBadge();

  console.log('Verible: Content script cleanup completed');
}

// Listen for page unload to cleanup
window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);

// Helper function to send message with retry logic
async function sendMessageWithRetry(
  runtime: any, 
  message: any, 
  maxRetries: number = 3, 
  delayMs: number = 1000
): Promise<any> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Verible: Sending message (attempt ${attempt}/${maxRetries}):`, message.type);
      
      // Create a promise with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Message timeout')), CONFIG.API_TIMEOUT);
      });
      
      const messagePromise = runtime.sendMessage(message);
      const response = await Promise.race([messagePromise, timeoutPromise]);
      
      console.log(`Verible: Message sent successfully on attempt ${attempt}`);
      return response;
    } catch (error: any) {
      lastError = error;
      console.warn(`Verible: Message send failed (attempt ${attempt}/${maxRetries}):`, error?.message || error);
      
      // Don't retry if we've exhausted attempts
      if (attempt < maxRetries) {
        // Exponential backoff
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        console.log(`Verible: Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  // All retries failed
  throw lastError || new Error('Failed to send message after retries');
}

function detectMarketplace(): string | null {
  const hostname = window.location.hostname.toLowerCase();
  
  // Only detect supported marketplaces
  if (hostname.includes('jiji.ng')) {
    return 'jiji';
  }
  if (hostname.includes('ebay.com')) {
    return 'ebay';
  }
  if (hostname.includes('etsy.com')) {
    return 'etsy';
  }
  if (hostname.includes('jumia.com')) {
    return 'jumia';
  }
  if (hostname.includes('konga.com')) {
    return 'konga';
  }
  if (hostname.includes('kijiji.')) {
    return 'kijiji';
  }
  
  return null;
}

function extractSellerInfo(platform: string): any | null {
  switch (platform) {
    case 'jiji':
      return extractJijiSellerInfo();
    case 'ebay':
      return extractEbaySellerInfo();
    case 'etsy':
      return extractEtsySellerInfo();
    case 'jumia':
      return extractJumiaSellerInfo();
    case 'konga':
      return extractKongaSellerInfo();
    case 'kijiji':
      return extractKijijiSellerInfo();
    default:
      return null;
  }
}

function extractJijiSellerInfo() {
  // Jiji.ng seller extraction
  const sellerNameEl = document.querySelector('.seller-name') || 
                      document.querySelector('.user-name');
  const priceEl = document.querySelector('.price') || 
                 document.querySelector('.amount');
  const locationEl = document.querySelector('.location') || 
                    document.querySelector('.address');
  const descriptionEl = document.querySelector('.description') || 
                       document.querySelector('.ad-description');
  
  if (!sellerNameEl) return null;
  
  return {
    name: sellerNameEl.textContent?.trim(),
    price: priceEl?.textContent?.trim(),
    location: locationEl?.textContent?.trim(),
    description: descriptionEl?.textContent?.trim(),
    platform: 'Jiji.ng'
  };
}

function extractEbaySellerInfo() {
  // eBay seller/store extraction
  // For store pages: /str/storename
  // For user pages: /usr/username
  const sellerNameEl = document.querySelector('h1[class*="store-name"]') ||
                      document.querySelector('h1[class*="seller-name"]') ||
                      document.querySelector('.store-name') ||
                      document.querySelector('.seller-name') ||
                      document.querySelector('h1');
  const storeDescriptionEl = document.querySelector('[class*="store-description"]') ||
                            document.querySelector('.store-description');
  
  // Try to get seller info from various eBay selectors
  const sellerInfo = {
    name: sellerNameEl?.textContent?.trim() || 'eBay Seller',
    description: storeDescriptionEl?.textContent?.trim(),
    platform: 'eBay',
    url: window.location.href
  };
  
  return sellerInfo;
}

function extractEtsySellerInfo() {
  // Etsy shop extraction
  const shopNameEl = document.querySelector('h1[data-shop-name]') ||
                     document.querySelector('h1') ||
                     document.querySelector('[data-shop-name]');
  const shopDescriptionEl = document.querySelector('[data-shop-description]') ||
                           document.querySelector('.shop-description');
  
  return {
    name: shopNameEl?.textContent?.trim() || shopNameEl?.getAttribute('data-shop-name') || 'Etsy Shop',
    description: shopDescriptionEl?.textContent?.trim(),
    platform: 'Etsy',
    url: window.location.href
  };
}

function extractJumiaSellerInfo() {
  // Jumia seller profile extraction
  const sellerNameEl = document.querySelector('h1') ||
                       document.querySelector('[class*="seller-name"]') ||
                       document.querySelector('[class*="seller"] h1');
  const sellerScoreEl = document.querySelector('[class*="seller-score"]') ||
                       document.querySelector('[class*="score"]');
  const followersEl = document.querySelector('[class*="followers"]');
  
  return {
    name: sellerNameEl?.textContent?.trim() || 'Jumia Seller',
    score: sellerScoreEl?.textContent?.trim(),
    followers: followersEl?.textContent?.trim(),
    platform: 'Jumia',
    url: window.location.href
  };
}

function extractKongaSellerInfo() {
  // Konga merchant extraction
  const merchantNameEl = document.querySelector('h1') ||
                         document.querySelector('[class*="merchant-name"]') ||
                         document.querySelector('[class*="store-name"]');
  
  return {
    name: merchantNameEl?.textContent?.trim() || 'Konga Merchant',
    platform: 'Konga',
    url: window.location.href
  };
}

function extractKijijiSellerInfo() {
  // Kijiji profile extraction
  const profileNameEl = document.querySelector('h1') ||
                        document.querySelector('[class*="profile-name"]') ||
                        document.querySelector('[class*="user-name"]');
  
  return {
    name: profileNameEl?.textContent?.trim() || 'Kijiji User',
    platform: 'Kijiji',
    url: window.location.href
  };
}

async function injectTrustOverlay(sellerInfo: any, platform: string) {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('verible-trust-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create trust overlay with loading state
  const overlay = document.createElement('div');
  overlay.id = 'verible-trust-overlay';
  overlay.innerHTML = createTrustOverlayHTML(sellerInfo); // Show loading state
  
  // Add styles
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    padding: 16px;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  `;

  // Add to page (show loading state immediately)
  document.body.appendChild(overlay);

  // Request analysis from background script
  try {
    const runtime = getRuntimeAPI();
    if (!runtime) {
      throw new Error('Runtime API not available');
    }
    
    const response = await runtime.sendMessage({
      type: 'ANALYZE_SELLER',
      data: sellerInfo
    });

    if (response && response.success && response.data) {
      // Update overlay with real analysis data
      overlay.innerHTML = createTrustOverlayHTML(sellerInfo, response.data);

  // Add click handler for detailed view
  const scoreElement = overlay.querySelector('.verible-score');
  if (scoreElement) {
    scoreElement.addEventListener('click', () => {
          openDetailedView(sellerInfo, response.data);
        });
      }
    } else {
      // Show error state
      overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
            <span style="font-weight: 600; color: #1f2937;">Verible Trust</span>
          </div>
        </div>
        <div style="padding: 12px; text-align: center; color: #ef4444;">
          <div>Unable to analyze seller</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${response?.error || 'Please try again'}</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Verible: Error getting analysis:', error);
    // Show error state
    overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
          <span style="font-weight: 600; color: #1f2937;">Verible Trust</span>
        </div>
      </div>
      <div style="padding: 12px; text-align: center; color: #ef4444;">
        <div>Analysis failed</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Please sign in to the extension</div>
      </div>
    `;
  }
}

function createTrustOverlayHTML(sellerInfo: any, analysisData?: any): string {
  // Use real analysis data if available, otherwise show loading
  const pulseScore = analysisData?.score || analysisData?.pulseScore || null;
  // Use backend's riskLevel if available, otherwise calculate it (fallback)
  const riskLevel = analysisData?.riskLevel || 
                   (pulseScore ? (pulseScore >= 75 ? 'Trusted' : pulseScore >= 45 ? 'Uncertain' : 'Avoid') : null);
  const confidence = analysisData?.confidence || analysisData?.confidenceLevel || (pulseScore ? 'High' : null);
  
  const scoreColor = pulseScore ? (pulseScore >= 90 ? '#047857' : pulseScore >= 75 ? '#10B981' : pulseScore >= 45 ? '#F59E0B' : '#EF4444') : '#6b7280';
  const badgeColor = riskLevel ? (riskLevel === 'Trusted' ? '#D1FAE5' : riskLevel === 'Uncertain' ? '#FEF3C7' : '#FEE2E2') : '#f3f4f6';
  const badgeTextColor = riskLevel ? (riskLevel === 'Trusted' ? '#065F46' : riskLevel === 'Uncertain' ? '#92400E' : '#991B1B') : '#6b7280';

  if (!pulseScore) {
    // Loading state
    return `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
          <span style="font-weight: 600; color: #1f2937;">Verible Trust</span>
        </div>
      </div>
      
      <div style="padding: 12px; text-align: center; color: #6b7280;">
        <div style="margin-bottom: 8px;">Analyzing seller...</div>
        <div style="width: 100%; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
          <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); animation: loading 1.5s infinite;"></div>
        </div>
      </div>
      
      <style>
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      </style>
    `;
  }

  return `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
        <span style="font-weight: 600; color: #1f2937;">Verible Trust</span>
      </div>
    </div>
    
    <div class="verible-score" style="cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <div style="width: 50px; height: 50px; border: 3px solid ${scoreColor}; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white;">
        <span style="font-size: 18px; font-weight: bold; color: ${scoreColor};">${pulseScore}</span>
        <span style="font-size: 8px; color: #6b7280; text-transform: uppercase;">Pulse</span>
      </div>
      <div style="flex: 1;">
        ${riskLevel ? `<div style="display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: ${badgeColor}; color: ${badgeTextColor}; margin-bottom: 4px;">${riskLevel}</div>` : ''}
        ${confidence ? `<div style="font-size: 12px; color: #6b7280;">Confidence: ${confidence}</div>` : ''}
      </div>
    </div>
    
    <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
      Click for detailed analysis
    </div>
  `;
}

// Show Verible badge/toast on the page
function showVeribleBadge(profileUrl: string, isLoading: boolean = false, scoreData: any = null, error: string | null = null) {
  // Check if badge already exists - if so, update it in place instead of removing/recreating
  const existingBadge = document.getElementById('verible-page-badge');
  
  if (existingBadge) {
    // Update existing badge in place (preserves any timers, listeners, etc.)
    console.log('Verible: Updating existing badge in place');
    updateBadgeInPlace(existingBadge as HTMLElement, profileUrl, isLoading, scoreData, error);
    return;
  }
  
  // No existing badge - remove helper messages if present
  const existingHelper = document.getElementById('verible-helper-message');
  if (existingHelper) {
    existingHelper.remove();
  }
  
  // Also remove any old trust overlay that might exist
  const existingOverlay = document.getElementById('verible-trust-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Wait for body to be available
  const ensureBody = () => {
    if (document.body) {
      createBadge(profileUrl, isLoading, scoreData, error);
    } else {
      setTimeout(ensureBody, 100);
    }
  };
  
  ensureBody();
}

// Update existing badge in place (preserves badge instance, timers, listeners)
function updateBadgeInPlace(badge: HTMLElement, profileUrl: string, isLoading: boolean, scoreData: any, error: string | null) {
  // Reuse the same logic from createBadge to generate content
  let badgeContent = '';
  let badgeColor = '#10B981';
  let borderColor = '#10B981';
  
  // Generate content based on state (reuse logic from createBadge)
  if (isLoading) {
    badgeContent = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Analyzing seller...</span>
          <div style="width: 100px; height: 2px; background: #e5e7eb; border-radius: 1px; overflow: hidden;">
            <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); animation: loading 1.5s infinite;"></div>
          </div>
        </div>
      </div>
    `;
    badgeColor = '#6B7280';
    borderColor = '#6B7280';
  } else if (error) {
    badgeContent = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: #EF4444; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">!</div>
        <span style="font-weight: 600; color: #1f2937; font-size: 14px;">${error}</span>
      </div>
    `;
    badgeColor = '#EF4444';
    borderColor = '#EF4444';
  } else if (scoreData) {
    const pulseScore = scoreData.pulseScore;
    const scoringStatus = scoreData.scoringStatus;
    const hasMarketplaceData = scoreData.hasMarketplaceData || 
                              (scoreData.marketplaceData && (
                                scoreData.marketplaceData.avgRating > 0 ||
                                scoreData.marketplaceData.totalReviews > 0 ||
                                scoreData.marketplaceData.followers > 0 ||
                                scoreData.marketplaceData.successfulSales > 0 ||
                                scoreData.sellerMetrics?.itemsSold > 0
                              ));
    
    if (pulseScore === null || pulseScore === undefined || scoringStatus === 'insufficient_data') {
      if (hasMarketplaceData) {
        const marketplaceData = scoreData.marketplaceData || {};
        const sellerMetrics = scoreData.sellerMetrics || {};
        const platform = scoreData.platform || 'marketplace';
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        
        const metrics = [];
        if (marketplaceData.avgRating > 0) {
          metrics.push(`⭐ ${marketplaceData.avgRating.toFixed(1)} rating`);
        }
        if (sellerMetrics.positiveFeedbackPercent > 0) {
          metrics.push(`👍 ${sellerMetrics.positiveFeedbackPercent}% positive`);
        }
        if (marketplaceData.successfulSales > 0 || sellerMetrics.itemsSold > 0) {
          const sales = marketplaceData.successfulSales || sellerMetrics.itemsSold || 0;
          const salesText = sales >= 1000000 ? `${(sales / 1000000).toFixed(1)}M` : 
                          sales >= 1000 ? `${(sales / 1000).toFixed(1)}K` : sales;
          metrics.push(`📦 ${salesText} sales`);
        }
        if (marketplaceData.followers > 0) {
          const followers = marketplaceData.followers;
          const followersText = followers >= 1000000 ? `${(followers / 1000000).toFixed(1)}M` : 
                               followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers;
          metrics.push(`👥 ${followersText} followers`);
        }
        if (marketplaceData.verificationStatus && marketplaceData.verificationStatus !== 'unverified') {
          metrics.push(`✓ ${marketplaceData.verificationStatus}`);
        }
        
        badgeColor = '#6B7280';
        borderColor = '#6B7280';
        
        badgeContent = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 32px; height: 32px; background: #6B7280; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">?</div>
              <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 700; color: #1f2937; font-size: 16px;">${platformName} Seller Data</span>
                <span style="font-size: 12px; color: #6b7280;">Score unavailable - marketplace metrics shown</span>
              </div>
            </div>
            ${metrics.length > 0 ? `
              <div style="display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                ${metrics.map(m => `<span style="font-size: 11px; color: #374151; padding: 2px 6px; background: white; border-radius: 4px;">${m}</span>`).join('')}
              </div>
            ` : ''}
            <div style="font-size: 12px; color: #6b7280; font-style: italic;">Open extension to view ${platformName} metrics</div>
          </div>
        `;
      } else {
        badgeColor = '#6B7280';
        borderColor = '#6B7280';
        badgeContent = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; background: #6B7280; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">?</div>
            <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Insufficient data for analysis</span>
          </div>
        `;
      }
    } else {
      // Success state with score
      const confidenceLevel = scoreData.confidenceLevel || 'Unknown';
      const recommendations = scoreData.recommendations || [];
      const riskFactors = scoreData.riskFactors || [];
      
      if (pulseScore >= 90) {
        badgeColor = '#047857';
        borderColor = '#047857';
      } else if (pulseScore >= 75) {
        badgeColor = '#10B981';
        borderColor = '#10B981';
      } else if (pulseScore >= 45) {
        badgeColor = '#F59E0B';
        borderColor = '#F59E0B';
      } else {
        badgeColor = '#EF4444';
        borderColor = '#EF4444';
      }
      
      let credibilityMessage = '';
      if (recommendations.length > 0) {
        const topRecommendation = recommendations[0];
        credibilityMessage = topRecommendation.message || 'Seller analysis available';
      } else if (pulseScore >= 90) {
        credibilityMessage = 'Very high trust';
      } else if (pulseScore >= 75) {
        credibilityMessage = 'High trust';
      } else if (pulseScore >= 45) {
        credibilityMessage = 'Moderate trust level';
      } else {
        credibilityMessage = 'Low trust score - proceed with caution';
      }
      
      const riskIndicator = riskFactors.length > 0 ? `⚠️ ${riskFactors.length} risk${riskFactors.length > 1 ? 's' : ''}` : '';
      
      badgeContent = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background: ${badgeColor}; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">${Math.round(pulseScore)}</div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: #1f2937; font-size: 16px;">Trust Score: ${Math.round(pulseScore)}/100</span>
                <span style="padding: 2px 6px; background: ${badgeColor}20; color: ${badgeColor}; border-radius: 4px; font-size: 11px; font-weight: 600;">${confidenceLevel}</span>
              </div>
              <span style="font-size: 13px; color: #6b7280;">${credibilityMessage}</span>
              ${riskIndicator ? `<span style="font-size: 12px; color: #EF4444; font-weight: 500;">${riskIndicator}</span>` : ''}
            </div>
          </div>
          <div style="font-size: 12px; color: #6b7280; font-style: italic;">Open extension to view detailed analysis</div>
        </div>
      `;
    }
  } else {
    badgeContent = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
        <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Analyzing...</span>
      </div>
    `;
  }
  
  // Update content and styles in place
  badge.innerHTML = badgeContent;
  badge.style.borderColor = borderColor;
  badge.style.padding = scoreData ? '16px' : '12px 16px';
  
  // Update stored data on badge element
  (badge as any)._profileUrl = profileUrl;
  (badge as any)._scoreData = scoreData;
  
  console.log('Verible: Badge updated in place');
}

function createBadge(profileUrl: string, isLoading: boolean, scoreData: any, error: string | null) {
  // Create badge element
  const badge = document.createElement('div');
  badge.id = 'verible-page-badge';
  
  let badgeContent = '';
  let badgeColor = '#10B981'; // Default green
  let borderColor = '#10B981';
  let message = '';
  
  if (isLoading) {
    // Loading state
    badgeContent = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Analyzing seller...</span>
          <div style="width: 100px; height: 2px; background: #e5e7eb; border-radius: 1px; overflow: hidden;">
            <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); animation: loading 1.5s infinite;"></div>
          </div>
        </div>
      </div>
    `;
    badgeColor = '#6B7280';
    borderColor = '#6B7280';
  } else if (error) {
    // Error state
    badgeContent = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: #EF4444; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">!</div>
        <span style="font-weight: 600; color: #1f2937; font-size: 14px;">${error}</span>
      </div>
    `;
    badgeColor = '#EF4444';
    borderColor = '#EF4444';
  } else if (scoreData) {
    // Check if we have marketplace data but no score
    const hasMarketplaceData = scoreData.hasMarketplaceData || 
                              (scoreData.marketplaceData && (
                                scoreData.marketplaceData.avgRating > 0 ||
                                scoreData.marketplaceData.totalReviews > 0 ||
                                scoreData.marketplaceData.followers > 0 ||
                                scoreData.marketplaceData.successfulSales > 0 ||
                                scoreData.sellerMetrics?.itemsSold > 0
                              ));
    
    const pulseScore = scoreData.pulseScore;
    const scoringStatus = scoreData.scoringStatus;
    
    if (pulseScore === null || pulseScore === undefined || scoringStatus === 'insufficient_data') {
      // Insufficient data for scoring, but marketplace data available
      if (hasMarketplaceData) {
        const marketplaceData = scoreData.marketplaceData || {};
        const sellerMetrics = scoreData.sellerMetrics || {};
        const platform = scoreData.platform || 'marketplace';
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        
        // Build marketplace metrics display
        const metrics = [];
        if (marketplaceData.avgRating > 0) {
          metrics.push(`⭐ ${marketplaceData.avgRating.toFixed(1)} rating`);
        }
        if (sellerMetrics.positiveFeedbackPercent > 0) {
          metrics.push(`👍 ${sellerMetrics.positiveFeedbackPercent}% positive`);
        }
        if (marketplaceData.successfulSales > 0 || sellerMetrics.itemsSold > 0) {
          const sales = marketplaceData.successfulSales || sellerMetrics.itemsSold || 0;
          const salesText = sales >= 1000000 ? `${(sales / 1000000).toFixed(1)}M` : 
                          sales >= 1000 ? `${(sales / 1000).toFixed(1)}K` : sales;
          metrics.push(`📦 ${salesText} sales`);
        }
        if (marketplaceData.followers > 0) {
          const followers = marketplaceData.followers;
          const followersText = followers >= 1000000 ? `${(followers / 1000000).toFixed(1)}M` : 
                               followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers;
          metrics.push(`👥 ${followersText} followers`);
        }
        if (marketplaceData.verificationStatus && marketplaceData.verificationStatus !== 'unverified') {
          metrics.push(`✓ ${marketplaceData.verificationStatus}`);
        }
        
        badgeColor = '#6B7280';
        borderColor = '#6B7280';
        
        badgeContent = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 32px; height: 32px; background: #6B7280; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">?</div>
              <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 700; color: #1f2937; font-size: 16px;">${platformName} Seller Data</span>
                <span style="font-size: 12px; color: #6b7280;">Score unavailable - marketplace metrics shown</span>
              </div>
            </div>
            ${metrics.length > 0 ? `
              <div style="display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                ${metrics.map(m => `<span style="font-size: 11px; color: #374151; padding: 2px 6px; background: white; border-radius: 4px;">${m}</span>`).join('')}
              </div>
            ` : ''}
            <div style="font-size: 12px; color: #6b7280; font-style: italic;">Open extension to view ${platformName} metrics</div>
          </div>
        `;
      } else {
        // No score and no marketplace data
        badgeColor = '#6B7280';
        borderColor = '#6B7280';
        badgeContent = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; background: #6B7280; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">?</div>
            <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Insufficient data for analysis</span>
          </div>
        `;
      }
    } else {
      // Success state with score
      const confidenceLevel = scoreData.confidenceLevel || 'Unknown';
      const recommendations = scoreData.recommendations || [];
      const riskFactors = scoreData.riskFactors || [];
      
      // Determine color based on score
      if (pulseScore >= 90) {
        badgeColor = '#047857'; // Dark Green (Very High)
        borderColor = '#047857';
      } else if (pulseScore >= 75) {
        badgeColor = '#10B981'; // Green (High)
        borderColor = '#10B981';
      } else if (pulseScore >= 45) {
        badgeColor = '#F59E0B'; // Amber (Medium)
        borderColor = '#F59E0B';
      } else {
        badgeColor = '#EF4444'; // Red (Low)
        borderColor = '#EF4444';
      }
      
      // Get intelligent message
      let credibilityMessage = '';
      if (recommendations.length > 0) {
        const topRecommendation = recommendations[0];
        credibilityMessage = topRecommendation.message || 'Seller analysis available';
      } else if (pulseScore >= 90) {
        credibilityMessage = 'Very high trust';
      } else if (pulseScore >= 75) {
        credibilityMessage = 'High trust';
      } else if (pulseScore >= 45) {
        credibilityMessage = 'Moderate trust level';
      } else {
        credibilityMessage = 'Low trust score - proceed with caution';
      }
      
      // Risk indicator
      const riskIndicator = riskFactors.length > 0 ? `⚠️ ${riskFactors.length} risk${riskFactors.length > 1 ? 's' : ''}` : '';
      
      badgeContent = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background: ${badgeColor}; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">${Math.round(pulseScore)}</div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: #1f2937; font-size: 16px;">Trust Score: ${Math.round(pulseScore)}/100</span>
                <span style="padding: 2px 6px; background: ${badgeColor}20; color: ${badgeColor}; border-radius: 4px; font-size: 11px; font-weight: 600;">${confidenceLevel}</span>
              </div>
              <span style="font-size: 13px; color: #6b7280;">${credibilityMessage}</span>
              ${riskIndicator ? `<span style="font-size: 12px; color: #EF4444; font-weight: 500;">${riskIndicator}</span>` : ''}
            </div>
          </div>
          <div style="font-size: 12px; color: #6b7280; font-style: italic;">Open extension to view detailed analysis</div>
        </div>
      `;
    }
  } else {
    // Default/fallback - show loading state instead of "Hello"
    badgeContent = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
        <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Analyzing...</span>
      </div>
    `;
  }
  
  badge.innerHTML = badgeContent;
  
  // Store data on badge element for click handler to access
  (badge as any)._profileUrl = profileUrl;
  (badge as any)._scoreData = scoreData;
  
  // Style the badge with improved positioning and responsiveness
  badge.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: white;
    border: 2px solid ${borderColor};
    border-radius: 12px;
    padding: ${scoreData ? '16px' : '12px 16px'};
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    max-width: min(350px, calc(100vw - 40px));
    opacity: 0;
    transform: translateY(-10px);
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  `;
  
  // Add animation styles
  if (!document.getElementById('verible-badge-styles')) {
    const style = document.createElement('style');
    style.id = 'verible-badge-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add loading animation if needed
  if (isLoading) {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Hover effect
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'translateY(-2px)';
    badge.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.2)';
  });
  
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'translateY(0)';
    badge.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)';
  });
  
  // Click handler - clear score and open extension popup fresh
  badge.addEventListener('click', async () => {
  console.log('Verible badge clicked - opening extension with persisted seller');

  const runtime = getRuntimeAPI();
  if (!runtime) {
    console.error('Runtime API not available');
    return;
  }

  const badgeProfileUrl = (badge as any)._profileUrl || profileUrl;
  const badgeScoreData = (badge as any)._scoreData || null;

  try {
    await runtime.sendMessage({
      type: 'SET_ACTIVE_SELLER',
      data: {
        profileUrl: badgeProfileUrl,
        platform: detectMarketplaceFromUrl(),
        scoreData: badgeScoreData,
        detectedAt: Date.now()
      }
    });

    const response = await runtime.sendMessage({
      type: 'OPEN_POPUP'
    });

    console.log('Extension open response:', response);

    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transform = 'translateY(-10px)';
      badge.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (badge.parentNode) {
          badge.remove();
        }
      }, 300);
    }, 100);

  } catch (error) {
    console.error('Error opening extension with seller data:', error);

    badge.style.opacity = '0';
    badge.style.transform = 'translateY(-10px)';
    badge.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (badge.parentNode) {
        badge.remove();
      }
    }, 300);
  }
});

  
  
  
  // Badge stays visible until user clicks it - no auto-dismiss
  // Store null timer on badge element for compatibility (in case any code checks for it)
  (badge as any)._autoDismissTimer = null;
  
  // Add to page
  document.body.appendChild(badge);
  
  // OPTIMIZATION: Show immediately (removed 100ms delay for faster display)
  // Use requestAnimationFrame for smooth rendering without blocking
  requestAnimationFrame(() => {
    badge.style.opacity = '1';
    badge.style.transform = 'translateY(0)';
  });
  
  console.log('Verible badge displayed on page');
}

// Remove Verible badge from page
function removeVeribleBadge() {
  const existingBadge = document.getElementById('verible-page-badge');
  if (existingBadge) {
    // Clear auto-dismiss timer if it exists
    const timer = (existingBadge as any)._autoDismissTimer;
    if (timer) {
      clearTimeout(timer);
    }
    
    existingBadge.style.opacity = '0';
    existingBadge.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      existingBadge.remove();
    }, 300);
  }
  // Also remove helper message if exists
  const existingHelper = document.getElementById('verible-helper-message');
  if (existingHelper) {
    existingHelper.remove();
  }
}

// Show helper message for eBay when not on seller profile
function showEbayHelperMessage() {
  // Remove existing messages
  removeVeribleBadge();
  
  const ensureBody = () => {
    if (document.body) {
      createEbayHelperMessage();
    } else {
      setTimeout(ensureBody, 100);
    }
  };
  
  ensureBody();
}

function createEbayHelperMessage() {
  // Remove existing helper if present
  const existing = document.getElementById('verible-helper-message');
  if (existing) existing.remove();

  const helper = document.createElement('div');
  helper.id = 'verible-helper-message';
  helper.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">V</div>
      <span style="font-weight: 600; color: #1f2937; font-size: 14px;">Click on a seller's profile to analyze</span>
    </div>
  `;
  
  helper.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: #f0f9ff;
    border: 2px solid #3b82f6;
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transform: translateY(-10px);
    max-width: 300px;
  `;
  
  document.body.appendChild(helper);
  
  // Animate in
  setTimeout(() => {
    helper.style.opacity = '1';
    helper.style.transform = 'translateY(0)';
    helper.style.transition = 'all 0.3s ease';
  }, 100);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    helper.style.opacity = '0';
    helper.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      helper.remove();
    }, 300);
  }, 5000);
  
  console.log('Verible helper message displayed for eBay');
}

function openDetailedView(sellerInfo: any, analysisData?: any) {
  // Open extension popup to show detailed view
  console.log('Opening detailed view for seller:', sellerInfo, analysisData);
  
  // Try to open the extension popup
  try {
    const runtime = getRuntimeAPI();
    if (runtime) {
      runtime.sendMessage({
        type: 'OPEN_DETAILED_VIEW',
        data: {
          sellerInfo,
          analysisData
        }
      });
    }
    
    // Also show a modal with the analysis data
    const modal = document.createElement('div');
    modal.id = 'verible-detail-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const pulseScore = analysisData?.score || analysisData?.pulseScore || 'N/A';
    const riskLevel = analysisData?.riskLevel || 'Unknown';
    const confidence = analysisData?.confidence || 'Unknown';
    const reasons = analysisData?.reasons || analysisData?.insights || ['No additional insights available'];
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1f2937;">Verible Trust Analysis</h2>
          <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Seller</div>
          <div style="font-size: 18px; font-weight: 600; color: #1f2937;">${sellerInfo.name}</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${sellerInfo.platform}</div>
        </div>
        
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
          <div style="flex: 1;">
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Pulse Score</div>
            <div style="font-size: 32px; font-weight: bold; color: ${pulseScore >= 90 ? '#047857' : pulseScore >= 75 ? '#10B981' : pulseScore >= 45 ? '#F59E0B' : '#EF4444'};">${pulseScore}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Risk Level</div>
            <div style="font-size: 18px; font-weight: 600; color: #1f2937;">${riskLevel}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Confidence: ${confidence}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">Key Insights</div>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            ${reasons.map((reason: string) => `<li style="margin-bottom: 8px;">${reason}</li>`).join('')}
          </ul>
        </div>
        
        <button id="close-modal-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    const closeModal = () => {
      modal.remove();
    };
    
    modal.querySelector('#close-modal')?.addEventListener('click', closeModal);
    modal.querySelector('#close-modal-btn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  } catch (error) {
    console.error('Verible: Error opening detailed view:', error);
    // Fallback to alert
    const pulseScore = analysisData?.score || analysisData?.pulseScore || 'N/A';
    alert(`Verible Trust Analysis\n\nSeller: ${sellerInfo.name}\nPulse Score: ${pulseScore}/100`);
  }
}
