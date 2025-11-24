// Declare browser API for WXT framework
declare const browser: any;
declare const chrome: any;

// Import WXT storage API (auto-imported, but explicit for clarity)
import { storage } from '#imports';

export default defineBackground(() => {
  // Get browser API (WXT provides this, but fallback to chrome for compatibility)
  const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  
  if (!browserAPI) {
    console.error('Browser API not available - extension may not work correctly');
    return;
  }

  console.log('Verible: Background script loaded', { 
    id: browserAPI.runtime?.id || 'unknown',
    hasAction: !!browserAPI.action,
    hasTabs: !!browserAPI.tabs,
    hasStorage: !!browserAPI.storage
  });

  // API configuration
  const API_BASE_URL = 'https://verible-backend.vercel.app';

  // Current seller data being tracked
  let currentSellerData: {
    profileUrl: string;
    sellerId?: string;
    pulseScore?: number;
    riskLevel?: string;
  } | null = null;

  // Cache for API responses (reduces duplicate calls)
  const apiCache = new Map<string, {
    data: any;
    timestamp: number;
    expiresAt: number;
  }>();
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000; // 1 second initial delay

  // Helper function to make API requests with retry logic
  async function makeApiRequest(
    endpoint: string, 
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<any> {
    try {
      // Get auth token from WXT storage
      let token = null;
      try {
        token = await storage.getItem<string>('local:authToken');
      } catch (storageError) {
        console.warn('Could not get auth token from storage:', storageError);
        // Continue without token - API might work without auth for some endpoints
      }

      const requestOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      };

      // Ensure body is properly set
      if (options.body) {
        requestOptions.body = options.body;
      }

      // Check cache for GET requests
      if (requestOptions.method === 'GET') {
        const cacheKey = `${endpoint}`;
        const cached = apiCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          console.log('Using cached API response for:', endpoint);
          return cached.data;
        }
      }

      console.log('Making API request:', {
        url: `${API_BASE_URL}${endpoint}`,
        method: requestOptions.method,
        retryAttempt: retryCount,
        hasBody: !!requestOptions.body
      });

      const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

      console.log('API response status:', response.status, response.statusText);

      if (!response.ok) {
        // Retry on 5xx errors or network errors
        if ((response.status >= 500 || response.status === 0) && retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
          console.log(`API request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeApiRequest(endpoint, options, retryCount + 1);
        }

        // Try to get error message from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.text();
          console.error('API error response:', errorData);
          if (errorData) {
            try {
              const errorJson = JSON.parse(errorData);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              errorMessage = errorData.substring(0, 200) || errorMessage;
            }
          }
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('API response data received');

      // Cache successful GET responses
      if (requestOptions.method === 'GET' && responseData) {
        const cacheKey = `${endpoint}`;
        apiCache.set(cacheKey, {
          data: responseData,
          timestamp: Date.now(),
          expiresAt: Date.now() + CACHE_EXPIRY_MS
        });
      }

      return responseData;
    } catch (error: any) {
      // Retry on network errors
      if (retryCount < MAX_RETRIES && (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('network')
      )) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.log(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeApiRequest(endpoint, options, retryCount + 1);
      }

      console.error('API request failed:', error);
      throw error;
    }
  }

  // Clean expired cache entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, cached] of apiCache.entries()) {
      if (now > cached.expiresAt) {
        apiCache.delete(key);
      }
    }
  }, 60 * 1000); // Every minute

  // Helper function to get badge color based on pulse score
  function getBadgeColor(pulseScore: number): string {
    if (pulseScore >= 75) return '#10B981'; // Green (Trustpilot green)
    if (pulseScore >= 45) return '#F59E0B'; // Amber (Trustpilot amber)
    return '#EF4444'; // Red (Trustpilot red)
  }

  // Helper function to get badge text color
  function getBadgeTextColor(pulseScore: number): string {
    if (pulseScore >= 75) return '#FFFFFF';
    if (pulseScore >= 45) return '#FFFFFF';
    return '#FFFFFF';
  }

  // WXT storage is already imported, no need for getStorageAPI function

  // Get action API (handles both Chrome and Firefox)
  function getActionAPI() {
    // Try browserAPI.action first (Firefox/standard)
    if (browserAPI && browserAPI.action) {
      return browserAPI.action;
    }
    // Fallback to chrome.action (Chrome)
    if ((globalThis as any).chrome && (globalThis as any).chrome.action) {
      return (globalThis as any).chrome.action;
    }
    console.error('Action API not found. Available APIs:', browserAPI ? Object.keys(browserAPI) : 'browserAPI is undefined');
    return null;
  }

  // Update extension badge with seller trust score
  async function updateBadge(profileUrl: string, pulseScore?: number, sellerId?: string) {
    try {
      const action = getActionAPI();
      if (!action) {
        console.error('Badge API not available');
        return;
      }

      console.log('Updating badge:', { profileUrl, pulseScore, sellerId });

      if (pulseScore !== undefined && pulseScore !== null) {
        // Show pulse score on badge
        const scoreText = Math.round(pulseScore).toString();
        const color = getBadgeColor(pulseScore);
        const riskLevel = pulseScore >= 75 ? 'Trusted' : pulseScore >= 45 ? 'Uncertain' : 'Avoid';
        
        console.log('Setting badge:', { scoreText, color, riskLevel });
        
        // Set badge text and color
        try {
          await action.setBadgeText({ text: scoreText });
          await action.setBadgeBackgroundColor({ color });
          console.log('Badge updated successfully:', scoreText);
        } catch (badgeError) {
          console.error('Error setting badge:', badgeError);
          // Try alternative API format
          try {
            await action.setBadgeText(scoreText);
            await action.setBadgeBackgroundColor(color);
          } catch (altError) {
            console.error('Alternative badge API also failed:', altError);
          }
        }
        
        // Set badge title (tooltip) for better UX
        const title = `Verible Trust Score: ${scoreText}/100 (${riskLevel})\nOpen extension to view seller details`;
        try {
          await action.setTitle({ title });
        } catch (e) {
          // Some browsers might not support setTitle, that's okay
          console.log('setTitle not supported:', e);
        }
        
        // Store current seller data
        currentSellerData = {
          profileUrl,
          sellerId,
          pulseScore,
          riskLevel
        };
        
        // Store in browser storage so popup can access it when opened
        await storage.setItem('local:pendingSellerAnalysis', currentSellerData);
        await storage.setItem('local:openSellerAnalysis', true);
      } else {
        // Show loading indicator
        console.log('Setting loading badge');
        try {
          await action.setBadgeText({ text: '...' });
          await action.setBadgeBackgroundColor({ color: '#6B7280' });
        } catch (badgeError) {
          console.error('Error setting loading badge:', badgeError);
          try {
            await action.setBadgeText('...');
            await action.setBadgeBackgroundColor('#6B7280');
          } catch (altError) {
            console.error('Alternative loading badge API also failed:', altError);
          }
        }
        try {
          await action.setTitle({ title: 'Verible: Analyzing seller...' });
        } catch (e) {
          // Ignore if not supported
        }
      }
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  // Clear badge
  async function clearBadge() {
    try {
      const action = getActionAPI();
      if (!action) {
        console.error('Badge API not available for clearing');
        return;
      }

      try {
        await action.setBadgeText({ text: '' });
      } catch (e) {
        try {
          await action.setBadgeText('');
        } catch (e2) {
          console.error('Error clearing badge text:', e2);
        }
      }
      try {
        await action.setTitle({ title: 'Verible - Seller Trust Analysis' });
      } catch (e) {
        // Ignore if not supported
      }
      currentSellerData = null;
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  // Listen for messages from content scripts
  if (browserAPI && browserAPI.runtime && browserAPI.runtime.onMessage) {
    browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
      console.log('Verible: Received message:', message);
      
      switch (message.type) {
        case 'ANALYZE_SELLER':
          handleSellerAnalysis(message.data, sendResponse);
          return true; // Keep message channel open for async response
          
        case 'GET_TRUST_SCORE':
          handleTrustScoreRequest(message.data, sendResponse);
          return true;
          
        case 'SUBMIT_FEEDBACK':
          handleFeedbackSubmission(message.data, sendResponse);
          return true;

        case 'DETECT_SELLER_PAGE':
          handleSellerPageDetection(message.data, sendResponse);
          return true; // Keep channel open for async response

        case 'OPEN_EXTENSION_FROM_BADGE':
          // Store the profile URL for popup to use
          if (message.data && message.data.profileUrl) {
            storage.setItem('local:pendingSellerAnalysis', {
              profileUrl: message.data.profileUrl
            }).then(() => {
              return storage.setItem('local:openSellerAnalysis', true);
            }).then(() => {
              console.log('Stored seller data for popup');
              if (sendResponse) sendResponse({ success: true });
            }).catch((error: any) => {
              console.error('Error storing seller data:', error);
              if (sendResponse) sendResponse({ success: false, error: 'Failed to store data' });
            });
          }
          return true;

        case 'GET_CURRENT_SELLER':
          sendResponse({ success: true, data: currentSellerData });
          return false;
          
        default:
          console.log('Verible: Unknown message type:', message.type);
      }
    });
    console.log('Message listener registered successfully');
  } else {
    console.error('Runtime API not available for message listener');
  }

  // Store seller data whenever it's updated so popup can access it
  // This works even when popup is opened by clicking the extension icon
  // The popup will check for pendingSellerAnalysis when it loads

  // Handle seller analysis request
  async function handleSellerAnalysis(sellerData: any, sendResponse: Function) {
    try {
      console.log('Verible: Analyzing seller:', sellerData);
      
      // Call real API for seller analysis
      const response = await makeApiRequest('/api/analysis/seller', {
        method: 'POST',
        body: JSON.stringify(sellerData),
      });
      
      if (response.success && response.data) {
        sendResponse({
          success: true,
          data: response.data
        });
      } else {
        sendResponse({
          success: false,
          error: response.error || 'Failed to analyze seller'
        });
      }
    } catch (error) {
      console.error('Verible: Error analyzing seller:', error);
      sendResponse({
        success: false,
        error: 'Failed to analyze seller'
      });
    }
  }

  // Handle trust score request
  async function handleTrustScoreRequest(sellerId: string, sendResponse: Function) {
    try {
      // Call real API for trust score
      const response = await makeApiRequest(`/api/analysis/score/${sellerId}`);
      
      if (response.success && response.data) {
        sendResponse({
          success: true,
          data: response.data
        });
      } else {
        sendResponse({
          success: false,
          error: response.error || 'Failed to get trust score'
        });
      }
    } catch (error) {
      console.error('Verible: Error getting trust score:', error);
      sendResponse({
        success: false,
        error: 'Failed to get trust score'
      });
    }
  }

  // Handle feedback submission
  async function handleFeedbackSubmission(feedbackData: any, sendResponse: Function) {
    try {
      console.log('Verible: Processing feedback:', feedbackData);
      
      // Call real API for feedback submission
      const response = await makeApiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(feedbackData),
      });
      
      if (response.success) {
        sendResponse({
          success: true,
          message: 'Feedback submitted successfully'
        });
      } else {
        sendResponse({
          success: false,
          error: response.error || 'Failed to submit feedback'
        });
      }
    } catch (error) {
      console.error('Verible: Error processing feedback:', error);
      sendResponse({
        success: false,
        error: 'Failed to submit feedback'
      });
    }
  }

  // Handle seller page detection and update badge with API call (with improved error handling)
  async function handleSellerPageDetection(data: { profileUrl: string; platform?: string }, sendResponse?: Function) {
    try {
      const { profileUrl } = data;
      
      console.log('handleSellerPageDetection called with:', data);
      
      if (!profileUrl) {
        console.error('No profile URL provided');
        clearBadge();
        if (sendResponse) sendResponse({ success: false, error: 'No profile URL provided' });
        return;
      }

      // OPTIMIZATION: Show loading badge in parallel with cache check
      const action = getActionAPI();
      const loadingBadgePromise = action ? Promise.all([
        action.setBadgeText({ text: '...' }).catch((e: any) => console.error('Error setting loading badge text:', e)),
        action.setBadgeBackgroundColor({ color: '#6B7280' }).catch((e: any) => console.error('Error setting loading badge color:', e))
      ]) : Promise.resolve();

      // OPTIMIZATION: Check cache first and return immediately if found
      const cacheKey = `score-by-url:${profileUrl}`;
      const cached = apiCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        console.log('Using cached score for:', profileUrl);
        const cachedData = cached.data;
        if (cachedData && cachedData.success && cachedData.data) {
          const pulseScore = cachedData.data.scoringResult?.pulseScore;
          const scoringStatus = cachedData.data.scoringResult?.status;
          const confidenceLevel = cachedData.data.scoringResult?.confidenceLevel;
          const recommendations = cachedData.data.scoringResult?.recommendations || [];
          const riskFactors = cachedData.data.scoringResult?.riskFactors || [];
          // Use backend's riskLevel if available, otherwise calculate it
          const riskLevel = cachedData.data.scoringResult?.riskLevel || 
                          cachedData.data.riskLevel ||
                          (pulseScore !== undefined && pulseScore !== null 
                            ? (pulseScore >= 75 ? 'Trusted' : pulseScore >= 45 ? 'Uncertain' : 'Avoid')
                            : null);

          // Extract marketplace data
          const extractedData = cachedData.data.extractedData;
          const marketplaceData = extractedData?.marketplaceData || cachedData.data.marketplaceData;
          const sellerMetrics = extractedData?.sellerMetrics;
          const profileData = extractedData?.profileData || cachedData.data.profileData;
          const platform = extractedData?.platform || data.platform || 'unknown';
          const hasMarketplaceData = marketplaceData && (
            marketplaceData.avgRating > 0 ||
            marketplaceData.totalReviews > 0 ||
            marketplaceData.followers > 0 ||
            marketplaceData.successfulSales > 0 ||
            sellerMetrics?.itemsSold > 0
          );

          if (pulseScore !== undefined && pulseScore !== null && action) {
            const scoreText = Math.round(pulseScore).toString();
            // Use riskLevel to determine color, or fallback to score-based calculation
            const color = riskLevel === 'Trusted' ? '#10B981' : 
                         riskLevel === 'Uncertain' ? '#F59E0B' : 
                         riskLevel === 'Avoid' ? '#EF4444' :
                         (pulseScore >= 75 ? '#10B981' : pulseScore >= 45 ? '#F59E0B' : '#EF4444');
            
            // OPTIMIZATION: Update badge and storage in parallel
            const badgeUpdate = action.setBadgeText({ text: scoreText }).then(() => 
              action.setBadgeBackgroundColor({ color })
            ).catch((e: any) => console.error('Error setting badge:', e));

            const storageUpdate = storage.setItem('local:pendingSellerAnalysis', {
              profileUrl,
              pulseScore,
              riskLevel,
              confidenceLevel,
              recommendations,
              riskFactors,
              profileData,
              marketplaceData,
              sellerMetrics,
              platform,
              scoringStatus
            }).then(() => 
              storage.setItem('local:openSellerAnalysis', true)
            );

            // Wait for both to complete, then send response
            await Promise.all([badgeUpdate, storageUpdate]);

            if (sendResponse) {
              sendResponse({
                success: true,
                data: {
                  pulseScore,
                  riskLevel,
                  confidenceLevel,
                  recommendations,
                  riskFactors,
                  profileData,
                  marketplaceData,
                  sellerMetrics,
                  platform,
                  scoringStatus
                }
              });
            }
            return;
          } else if ((scoringStatus === 'insufficient_data' || pulseScore === undefined) && hasMarketplaceData) {
            // Handle insufficient data with marketplace metrics
            if (action) {
              try {
                await action.setBadgeText({ text: '?' });
                await action.setBadgeBackgroundColor({ color: '#6B7280' });
              } catch (e) {
                console.error('Error setting marketplace data badge:', e);
              }
            }

            await storage.setItem('local:pendingSellerAnalysis', {
              profileUrl,
              pulseScore: null,
              riskLevel: null,
              confidenceLevel: null,
              recommendations,
              riskFactors: [],
              profileData,
              marketplaceData,
              sellerMetrics,
              platform,
              scoringStatus: 'insufficient_data',
              hasMarketplaceData: true
            });
            await storage.setItem('local:openSellerAnalysis', true);

            if (sendResponse) {
              sendResponse({
                success: true,
                data: {
                  pulseScore: null,
                  riskLevel: null,
                  confidenceLevel: null,
                  recommendations,
                  riskFactors: [],
                  profileData,
                  marketplaceData,
                  sellerMetrics,
                  platform,
                  scoringStatus: 'insufficient_data',
                  hasMarketplaceData: true
                }
              });
            }
            return;
          }
        }
      }

      // OPTIMIZATION: Don't wait for loading badge, start API call immediately
      // Call API to get seller score (with retry logic built into makeApiRequest)
      try {
        console.log('Calling score API for:', profileUrl);
        
        // Start API call immediately (loading badge update happens in parallel)
        const scoreResponsePromise = makeApiRequest('/api/sellers/score-by-url', {
          method: 'POST',
          body: JSON.stringify({ profileUrl }),
        });
        
        // Wait for loading badge to finish (non-blocking, but ensures it shows)
        await loadingBadgePromise;
        
        // Now wait for API response
        const scoreResponse = await scoreResponsePromise;
        
        console.log('Score API response received');

        // Cache the response
        apiCache.set(cacheKey, {
          data: scoreResponse,
          timestamp: Date.now(),
          expiresAt: Date.now() + CACHE_EXPIRY_MS
        });

        if (scoreResponse && scoreResponse.success && scoreResponse.data) {
          const pulseScore = scoreResponse.data.scoringResult?.pulseScore;
          const scoringStatus = scoreResponse.data.scoringResult?.status;
          const confidenceLevel = scoreResponse.data.scoringResult?.confidenceLevel;
          const recommendations = scoreResponse.data.scoringResult?.recommendations || [];
          const riskFactors = scoreResponse.data.scoringResult?.riskFactors || [];
          // Use backend's riskLevel if available, otherwise calculate it
          const riskLevel = scoreResponse.data.scoringResult?.riskLevel || 
                          scoreResponse.data.riskLevel ||
                          (pulseScore !== undefined && pulseScore !== null 
                            ? (pulseScore >= 75 ? 'Trusted' : pulseScore >= 45 ? 'Uncertain' : 'Avoid')
                            : null);

          // Extract marketplace data for display when score is unavailable
          const extractedData = scoreResponse.data.extractedData;
          const marketplaceData = extractedData?.marketplaceData || scoreResponse.data.marketplaceData;
          const sellerMetrics = extractedData?.sellerMetrics;
          const profileData = extractedData?.profileData || scoreResponse.data.profileData;
          const platform = extractedData?.platform || data.platform || 'unknown';

          // Check if we have insufficient data but marketplace metrics available
          const hasInsufficientData = scoringStatus === 'insufficient_data' || 
                                      (pulseScore === undefined && pulseScore === null && marketplaceData);
          const hasMarketplaceData = marketplaceData && (
            marketplaceData.avgRating > 0 ||
            marketplaceData.totalReviews > 0 ||
            marketplaceData.followers > 0 ||
            marketplaceData.successfulSales > 0 ||
            sellerMetrics?.itemsSold > 0 ||
            sellerMetrics?.positiveFeedbackPercent > 0
          );

          // OPTIMIZATION: Update badge and storage in parallel
          if (pulseScore !== undefined && pulseScore !== null && action) {
            const scoreText = Math.round(pulseScore).toString();
            // Use riskLevel to determine color, or fallback to score-based calculation
            const color = riskLevel === 'Trusted' ? '#10B981' : 
                         riskLevel === 'Uncertain' ? '#F59E0B' : 
                         riskLevel === 'Avoid' ? '#EF4444' :
                         (pulseScore >= 75 ? '#10B981' : pulseScore >= 45 ? '#F59E0B' : '#EF4444');
            
            // Update badge and storage in parallel for faster response
            const badgeUpdate = action.setBadgeText({ text: scoreText })
              .then(() => action.setBadgeBackgroundColor({ color }))
              .then(() => console.log('Badge updated with score:', scoreText))
              .catch((e: any) => console.error('Error setting badge:', e));

            const storageUpdate = storage.setItem('local:pendingSellerAnalysis', {
              profileUrl,
              pulseScore,
              riskLevel,
              confidenceLevel,
              recommendations,
              riskFactors,
              profileData,
              marketplaceData,
              sellerMetrics,
              platform,
              scoringStatus
            }).then(() => storage.setItem('local:openSellerAnalysis', true));

            // Wait for both to complete
            await Promise.all([badgeUpdate, storageUpdate]);

            if (sendResponse) {
              sendResponse({
                success: true,
                data: {
                  pulseScore,
                  riskLevel,
                  confidenceLevel,
                  recommendations,
                  riskFactors,
                  profileData,
                  marketplaceData,
                  sellerMetrics,
                  platform,
                  scoringStatus
                }
              });
            }
          } else if (hasInsufficientData && hasMarketplaceData) {
            // Insufficient data for scoring, but marketplace data available
            console.log('Insufficient data for scoring, but marketplace data available');
            
            if (action) {
              try {
                // Show "?" badge to indicate data available but no score
                await action.setBadgeText({ text: '?' });
                await action.setBadgeBackgroundColor({ color: '#6B7280' });
                await action.setTitle({ title: 'Marketplace data available - Open extension to view details' });
              } catch (e) {
                console.error('Error setting marketplace data badge:', e);
              }
            }

            // Store marketplace data for display
            await storage.setItem('local:pendingSellerAnalysis', {
              profileUrl,
              pulseScore: null,
              riskLevel: null,
              confidenceLevel: null,
              recommendations,
              riskFactors: [],
              profileData,
              marketplaceData,
              sellerMetrics,
              platform,
              scoringStatus: 'insufficient_data',
              hasMarketplaceData: true
            });
            await storage.setItem('local:openSellerAnalysis', true);

            if (sendResponse) {
              sendResponse({
                success: true,
                data: {
                  pulseScore: null,
                  riskLevel: null,
                  confidenceLevel: null,
                  recommendations,
                  riskFactors: [],
                  profileData,
                  marketplaceData,
                  sellerMetrics,
                  platform,
                  scoringStatus: 'insufficient_data',
                  hasMarketplaceData: true,
                  message: scoreResponse.message || 'Insufficient data for scoring, but marketplace metrics available'
                }
              });
            }
          } else {
            // No score and no marketplace data available
            if (action) {
              try {
                await action.setBadgeText({ text: 'N/A' });
                await action.setBadgeBackgroundColor({ color: '#6B7280' });
              } catch (e) {
                console.error('Error setting N/A badge:', e);
              }
            }
            if (sendResponse) sendResponse({ success: false, error: 'No score or marketplace data available' });
          }
        } else {
          console.error('Score API failed:', scoreResponse);
          const errorMessage = scoreResponse?.error || scoreResponse?.message || 'Failed to get score';
          if (action) {
            try {
              await action.setBadgeText({ text: '!' });
              await action.setBadgeBackgroundColor({ color: '#EF4444' });
            } catch (e) {
              console.error('Error setting error badge:', e);
            }
          }
          if (sendResponse) sendResponse({ success: false, error: errorMessage });
        }
      } catch (error: any) {
        console.error('Error calling score API:', error);
        const errorMessage = error?.message || 'Failed to analyze seller';
        
        // Provide more specific error messages
        let userFriendlyError = 'Failed to analyze seller';
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
          userFriendlyError = 'Network error. Please check your connection.';
        } else if (errorMessage.includes('timeout')) {
          userFriendlyError = 'Request timed out. Please try again.';
        } else if (errorMessage.includes('500') || errorMessage.includes('503')) {
          userFriendlyError = 'Server error. Please try again later.';
        }
        
        if (action) {
          try {
            await action.setBadgeText({ text: '!' });
            await action.setBadgeBackgroundColor({ color: '#EF4444' });
          } catch (e) {
            console.error('Error setting error badge:', e);
          }
        }
        if (sendResponse) sendResponse({ success: false, error: userFriendlyError });
      }
    } catch (error) {
      console.error('Error handling seller page detection:', error);
      clearBadge();
      if (sendResponse) sendResponse({ success: false, error: 'Internal error' });
    }
  }

  // Note: Tab listener is disabled - content script handles badge display
  // This prevents duplicate badges from being created
  // The content script will call handleSellerPageDetection via message

  // Listen for auth token expiration events
  browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (message.type === 'AUTH_TOKEN_EXPIRED') {
      console.log('Verible: Auth token expired, clearing storage');
      storage.removeItem('local:user').catch(() => {});
      storage.removeItem('local:authToken').catch(() => {});
      clearBadge();
    }
  });

  // Test function to manually trigger badge update (for debugging)
  // Can be called from browser console: chrome.runtime.sendMessage({type: 'TEST_BADGE', data: {pulseScore: 75}})
  browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (message.type === 'TEST_BADGE') {
      const testScore = message.data?.pulseScore || 75;
      const testUrl = message.data?.profileUrl || 'https://test.com/seller';
      console.log('TEST: Manually updating badge with score:', testScore);
      updateBadge(testUrl, testScore).then(() => {
        sendResponse({ success: true, message: 'Badge updated' });
      });
      return true;
    }
  });

  // Initialize: clear badge on startup and test API availability
  console.log('Verible: Initializing badge system...');
  console.log('Browser API available:', !!browserAPI);
  console.log('Action API available:', !!getActionAPI());
  console.log('Tabs API available:', !!browserAPI.tabs);
  
  // Test badge API on startup
  const action = getActionAPI();
  if (action) {
    console.log('Testing badge API...');
    action.setBadgeText({ text: '✓' })
      .then(() => {
        console.log('Badge API test successful');
        setTimeout(() => clearBadge(), 2000);
      })
      .catch((error: any) => {
        console.error('Badge API test failed:', error);
      });
  } else {
    console.error('Badge API not available - badge notifications will not work');
  }
  
  clearBadge();
});
