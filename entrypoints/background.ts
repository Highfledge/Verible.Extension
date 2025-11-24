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

  // Helper function to make API requests
  async function makeApiRequest(endpoint: string, options: RequestInit = {}) {
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

      console.log('Making API request:', {
        url: `${API_BASE_URL}${endpoint}`,
        method: requestOptions.method,
        hasBody: !!requestOptions.body,
        bodyPreview: requestOptions.body ? (typeof requestOptions.body === 'string' ? requestOptions.body.substring(0, 100) : 'object') : 'none'
      });

      const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

      console.log('API response status:', response.status, response.statusText);

      if (!response.ok) {
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
      return responseData;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

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
        const title = `Verible Trust Score: ${scoreText}/100 (${riskLevel})\nClick to view seller details`;
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

  // Handle seller page detection and update badge with API call
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

      // Show loading badge
      const action = getActionAPI();
      if (action) {
        try {
          await action.setBadgeText({ text: '...' });
          await action.setBadgeBackgroundColor({ color: '#6B7280' });
        } catch (e) {
          console.error('Error setting loading badge:', e);
        }
      }

      // Note: This API doesn't require authentication, so we proceed without checking auth token

      // Call API to get seller score
      try {
        console.log('Calling score API for:', profileUrl);
        console.log('Request body:', JSON.stringify({ profileUrl }));
        
        const scoreResponse = await makeApiRequest('/api/sellers/score-by-url', {
          method: 'POST',
          body: JSON.stringify({ profileUrl }),
        });
        
        console.log('API response status check:', scoreResponse);

        console.log('Score API response:', scoreResponse);

        if (scoreResponse && scoreResponse.success && scoreResponse.data) {
          const pulseScore = scoreResponse.data.scoringResult?.pulseScore;
          const confidenceLevel = scoreResponse.data.scoringResult?.confidenceLevel;
          const recommendations = scoreResponse.data.scoringResult?.recommendations || [];
          const riskFactors = scoreResponse.data.scoringResult?.riskFactors || [];

          // Update badge with pulse score
          if (pulseScore !== undefined && pulseScore !== null && action) {
            const scoreText = Math.round(pulseScore).toString();
            const color = pulseScore >= 75 ? '#10B981' : pulseScore >= 45 ? '#F59E0B' : '#EF4444';
            
            try {
              await action.setBadgeText({ text: scoreText });
              await action.setBadgeBackgroundColor({ color });
              console.log('Badge updated with score:', scoreText);
            } catch (e) {
              console.error('Error setting badge:', e);
            }

            // Store seller data for content script using WXT storage
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

            if (sendResponse) {
              sendResponse({
                success: true,
                data: {
                  pulseScore,
                  confidenceLevel,
                  recommendations,
                  riskFactors,
                  profileData: scoreResponse.data.profileData,
                  marketplaceData: scoreResponse.data.marketplaceData
                }
              });
            }
          } else {
            // No score available
            if (action) {
              try {
                await action.setBadgeText({ text: 'N/A' });
                await action.setBadgeBackgroundColor({ color: '#6B7280' });
              } catch (e) {}
            }
            if (sendResponse) sendResponse({ success: false, error: 'No score available' });
          }
        } else {
          console.error('Score API failed:', scoreResponse);
          const errorMessage = scoreResponse?.error || scoreResponse?.message || 'Failed to get score';
          if (action) {
            try {
              await action.setBadgeText({ text: '!' });
              await action.setBadgeBackgroundColor({ color: '#EF4444' });
            } catch (e) {}
          }
          if (sendResponse) sendResponse({ success: false, error: errorMessage });
        }
      } catch (error: any) {
        console.error('Error calling score API:', error);
        const errorMessage = error?.message || 'Failed to analyze seller';
        if (action) {
          try {
            await action.setBadgeText({ text: '!' });
            await action.setBadgeBackgroundColor({ color: '#EF4444' });
          } catch (e) {}
        }
        if (sendResponse) sendResponse({ success: false, error: errorMessage });
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
