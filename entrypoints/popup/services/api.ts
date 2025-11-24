// API Service for Verible Extension
declare const browser: any;
declare const chrome: any;

const API_BASE_URL = 'https://verible-backend.vercel.app';

// Import authService to get token
import { authService } from './authService';

// Helper function to get storage API
function getStorageAPI() {
  if (typeof browser !== 'undefined' && browser.storage) {
    return browser.storage;
  } else if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage;
  }
  return null;
}

// Helper function to get runtime API
function getRuntimeAPI() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser.runtime;
  } else if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  }
  return null;
}

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'seller' | 'admin'; // 'user' = Buyer, 'seller' = Seller
  verified: boolean;
  verificationMethod: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface LoginRequest {
  emailOrPhone: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  verificationMethod: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  code: string;
  emailOrPhone: string;
}

export interface ResendOTPRequest {
  emailOrPhone: string;
  method: string;
}

export interface RegistrationResponse {
  user: User;
  token: string;
  verificationSent: boolean;
  verificationMethod: string;
  verificationCode: string;
}

export interface ResendOTPResponse {
  message: string;
  verificationCode: string;
}

export interface VerifyEmailResponse {
  user: User;
  token: string;
  message: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
}

export interface Analysis {
  _id: string;
  sellerName: string;
  platform: string;
  score: number;
  riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
  timestamp: string;
  price?: string;
  location?: string;
}

export interface Seller {
  _id: string;
  sellerId: string;
  platform: string;
  profileUrl: string;
  pulseScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  verificationStatus: string;
  isActive: boolean;
  isClaimed: boolean;
  profileData: {
    name: string;
    profilePicture: string | null;
    location: string;
    bio: string;
  };
  marketplaceData: {
    accountAge: number;
    totalListings: number;
    avgRating: number;
    totalReviews: number;
    responseRate: number;
    verificationStatus: string;
    lastSeen?: string;
    followers: number;
    categories: Array<{ name: string; count: number; _id?: string }>;
  };
  trustIndicators?: {
    hasProfilePicture: boolean;
    hasLocation: boolean;
    hasBio: boolean;
    accountAge: number;
    totalReviews: number;
    avgRating: number;
    verificationStatus: string;
    followers: number;
    lastSeen?: string;
  };
  scoringFactors?: {
    urgencyScore: number;
    profileCompleteness: number;
    accountAge?: number;
    verificationStatus?: number;
    ratingScore?: number;
    reviewCount?: number;
    responseRate?: number;
    listingQuality?: number;
    activityScore?: number;
  };
  userId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
    verified: boolean;
  } | null;
  recentListings?: any[];
  listingHistory?: any[];
  flags?: any[];
  endorsements?: any[];
  firstSeen?: string;
  lastSeen?: string;
  lastScored?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Helper function to make API requests
async function makeRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get token from authService (handles decryption and storage)
    let token = null;
    
    try {
      const authData = await authService.getAuthData();
      if (authData && authData.token) {
        token = authData.token;
      }
    } catch (error) {
      console.warn('Could not get token from authService, trying direct storage:', error);
      // Fallback: try direct storage access
      try {
        const storage = getStorageAPI();
        if (storage) {
          const result = await storage.local.get(['authToken']);
          token = result.authToken;
        }
      } catch (e) {
        console.warn('Could not access storage:', e);
      }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 Unauthorized - token expired
      if (response.status === 401 && token) {
        const storage = getStorageAPI();
        const runtime = getRuntimeAPI();
        
        if (storage) {
          try {
            await storage.local.remove(['authToken', 'user']);
          } catch (error) {
            console.warn('Could not clear storage:', error);
          }
        }
        
        // Notify background script
        if (runtime) {
          try {
            runtime.sendMessage({ type: 'AUTH_TOKEN_EXPIRED' });
          } catch (error) {
            console.warn('Could not send message to background:', error);
          }
        }
      }
      
      return {
        success: false,
        error: data.error || data.message || `HTTP error! status: ${response.status}`,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  } catch (error: any) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

class ApiService {
  // Authentication endpoints (outside the app)
  
  async register(userData: RegisterRequest): Promise<ApiResponse<RegistrationResponse>> {
    return makeRequest<RegistrationResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: LoginRequest): Promise<ApiResponse<{ user: User; token: string }>> {
    // API returns: { success: true, message: "Login successful", data: { user: {...}, token: "..." } }
    const response = await makeRequest<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // makeRequest already extracts data.data, so response.data should be { user: {...}, token: "..." }
    // Just return it as is
    return response;
  }

  async resendOTP(emailOrPhone: string, method: string): Promise<ApiResponse<ResendOTPResponse>> {
    return makeRequest<ResendOTPResponse>('/api/auth/verify/resend', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, method }),
    });
  }

  async verifyEmail(code: string, emailOrPhone: string): Promise<ApiResponse<VerifyEmailResponse>> {
    return makeRequest<VerifyEmailResponse>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ code, emailOrPhone }),
    });
  }

  async requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    return makeRequest<{ message: string }>('/api/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
    return makeRequest<{ message: string }>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // In-app endpoints (require authentication)

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return makeRequest<User>('/api/auth/me');
  }

  async updateProfile(profileData: UpdateProfileRequest): Promise<ApiResponse<User>> {
    return makeRequest<User>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async deleteUser(): Promise<ApiResponse<{ message: string }>> {
    return makeRequest<{ message: string }>('/api/users/account', {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return makeRequest<{ status: string; timestamp: string }>('/api/health');
  }

  // Analysis endpoints
  
  async analyzeSeller(sellerData: {
    name: string;
    platform: string;
    price?: string;
    location?: string;
    description?: string;
  }): Promise<ApiResponse<{
    score: number;
    riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
    confidence: 'High' | 'Medium' | 'Low';
    reasons: string[];
    timestamp: string;
  }>> {
    return makeRequest<{
      score: number;
      riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
      confidence: 'High' | 'Medium' | 'Low';
      reasons: string[];
      timestamp: string;
    }>('/api/analysis/seller', {
      method: 'POST',
      body: JSON.stringify(sellerData),
    });
  }

  async getAnalysisHistory(limit?: number, offset?: number): Promise<ApiResponse<{
    analyses: Array<{
      _id: string;
      sellerName: string;
      platform: string;
      score: number;
      riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
      timestamp: string;
      price?: string;
      location?: string;
    }>;
    total: number;
  }>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const query = params.toString();
    return makeRequest<{
      analyses: Array<{
        _id: string;
        sellerName: string;
        platform: string;
        score: number;
        riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
        timestamp: string;
        price?: string;
        location?: string;
      }>;
      total: number;
    }>(`/api/analysis/history${query ? `?${query}` : ''}`);
  }

  async getRecentAnalyses(limit: number = 5): Promise<ApiResponse<Array<{
    _id: string;
    sellerName: string;
    platform: string;
    score: number;
    riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
    timestamp: string;
    price?: string;
    location?: string;
  }>>> {
    return makeRequest<Array<{
      _id: string;
      sellerName: string;
      platform: string;
      score: number;
      riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
      timestamp: string;
      price?: string;
      location?: string;
    }>>(`/api/analysis/recent?limit=${limit}`);
  }

  async getAnalysisById(analysisId: string): Promise<ApiResponse<{
    _id: string;
    sellerName: string;
    platform: string;
    score: number;
    riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
    confidence: 'High' | 'Medium' | 'Low';
    reasons: string[];
    timestamp: string;
    price?: string;
    location?: string;
    description?: string;
  }>> {
    return makeRequest<{
      _id: string;
      sellerName: string;
      platform: string;
      score: number;
      riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
      confidence: 'High' | 'Medium' | 'Low';
      reasons: string[];
      timestamp: string;
      price?: string;
      location?: string;
      description?: string;
    }>(`/api/analysis/${analysisId}`);
  }

  async getTrustScore(sellerId: string): Promise<ApiResponse<{
    score: number;
    riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
    confidence: 'High' | 'Medium' | 'Low';
  }>> {
    return makeRequest<{
      score: number;
      riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
      confidence: 'High' | 'Medium' | 'Low';
    }>(`/api/analysis/score/${sellerId}`);
  }

  async submitFeedback(feedbackData: {
    analysisId?: string;
    sellerName?: string;
    platform?: string;
    rating?: number;
    comment?: string;
    helpful?: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return makeRequest<{ message: string }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    });
  }

  // Seller Profile Extraction
  async extractSellerProfile(profileUrl: string): Promise<ApiResponse<{
    seller: Seller;
    extractedData?: any;
    scoringResult: {
      pulseScore: number;
      confidenceLevel: 'high' | 'medium' | 'low';
      recommendations: Array<{
        type: string;
        message: string;
        action: string;
      }>;
      trustIndicators: {
        accountVerification: string;
        transactionHistory: string;
        communicationQuality: string;
        disputeResolution: string;
      };
      riskFactors: Array<string | {
        category?: string;
        severity?: string;
        issue: string;
      }>;
    };
  }>> {
    return makeRequest<{
      seller: Seller;
      extractedData?: any;
      scoringResult: {
        pulseScore: number;
        confidenceLevel: 'high' | 'medium' | 'low';
        recommendations: Array<{
          type: string;
          message: string;
          action: string;
        }>;
        trustIndicators: {
          accountVerification: string;
          transactionHistory: string;
          communicationQuality: string;
          disputeResolution: string;
        };
        riskFactors: Array<string | {
          category?: string;
          severity?: string;
          issue: string;
        }>;
      };
    }>('/api/sellers/extract-profile', {
      method: 'POST',
      body: JSON.stringify({ profileUrl }),
    });
  }

  // Lookup seller by name and platform
  async lookupSellerByNamePlatform(name: string, platform: string): Promise<ApiResponse<{
    seller: Seller;
  }>> {
    const params = new URLSearchParams();
    params.append('name', name);
    params.append('platform', platform);

    return makeRequest<{
      seller: Seller;
    }>(`/api/sellers/lookup?${params.toString()}`);
  }

  // Search sellers by name, platform and location
  async searchSellersByNamePlatformLocation(name: string, platform: string, location: string): Promise<ApiResponse<{
    sellers: Array<Seller>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalSellers: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>> {
    const params = new URLSearchParams();
    params.append('name', name);
    params.append('platform', platform);
    params.append('location', location);

    return makeRequest<{
      sellers: Array<Seller>;
      pagination: {
        currentPage: number;
        totalPages: number;
        totalSellers: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(`/api/sellers/search?${params.toString()}`);
  }

  // Get top sellers
  async getTopSellers(limit: number = 10): Promise<ApiResponse<{
    sellers: Array<Seller>;
    count: number;
    total: number;
    stats?: {
      active: number;
      inactive: number;
      claimed: number;
      extracted: number;
    };
    query?: any;
    limit?: number;
  }>> {
    return makeRequest<{
      sellers: Array<Seller>;
      count: number;
      total: number;
      stats?: {
        active: number;
        inactive: number;
        claimed: number;
        extracted: number;
      };
      query?: any;
      limit?: number;
    }>(`/api/sellers/top?limit=${limit}`);
  }

  // Get all sellers
  async getAllSellers(limit?: number, offset?: number): Promise<ApiResponse<{
    sellers: Array<Seller>;
    count: number;
    total: number;
    stats?: {
      active: number;
      inactive: number;
      claimed: number;
      extracted: number;
    };
    query?: any;
    limit?: number;
  }>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const query = params.toString();
    return makeRequest<{
      sellers: Array<Seller>;
      count: number;
      total: number;
      stats?: {
        active: number;
        inactive: number;
        claimed: number;
        extracted: number;
      };
      query?: any;
      limit?: number;
    }>(`/api/sellers/all${query ? `?${query}` : ''}`);
  }

  // Flag a seller
  async flagSeller(sellerId: string, reason: string): Promise<ApiResponse<{
    newPulseScore: number;
    newConfidenceLevel: 'high' | 'medium' | 'low';
    totalFlags: number;
    netFeedbackScore: number;
  }>> {
    return makeRequest<{
      newPulseScore: number;
      newConfidenceLevel: 'high' | 'medium' | 'low';
      totalFlags: number;
      netFeedbackScore: number;
    }>(`/api/sellers/${sellerId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Endorse a seller
  async endorseSeller(sellerId: string, reason: string): Promise<ApiResponse<{
    newPulseScore: number;
    newConfidenceLevel: 'high' | 'medium' | 'low';
    totalEndorsements: number;
    netFeedbackScore: number;
  }>> {
    return makeRequest<{
      newPulseScore: number;
      newConfidenceLevel: 'high' | 'medium' | 'low';
      totalEndorsements: number;
      netFeedbackScore: number;
    }>(`/api/sellers/${sellerId}/endorse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Become a seller
  async becomeSeller(platform: string, profileUrl: string): Promise<ApiResponse<{
    message: string;
    seller?: any;
  }>> {
    return makeRequest<{
      message: string;
      seller?: any;
    }>('/api/sellers/become-seller', {
      method: 'POST',
      body: JSON.stringify({ platform, profileUrl }),
    });
  }

  // Get user feedback
  async getMyFeedback(): Promise<ApiResponse<{
    feedbackHistory: Array<{
      seller: {
        id: string;
        name: string;
        platform: string;
        pulseScore: number;
      };
      flag: {
        reason: string;
        timestamp: string;
        isVerified: boolean;
      } | null;
      endorsement: {
        reason: string;
        timestamp: string;
        isVerified: boolean;
      } | null;
    }>;
    totalInteractions: number;
  }>> {
    return makeRequest<{
      feedbackHistory: Array<{
        seller: {
          id: string;
          name: string;
          platform: string;
          pulseScore: number;
        };
        flag: {
          reason: string;
          timestamp: string;
          isVerified: boolean;
        } | null;
        endorsement: {
          reason: string;
          timestamp: string;
          isVerified: boolean;
        } | null;
      }>;
      totalInteractions: number;
    }>('/api/users/my-feedback');
  }

  // Delete flag
  async deleteFlag(sellerId: string): Promise<ApiResponse<{
    newPulseScore: number;
    newConfidenceLevel: 'high' | 'medium' | 'low';
    totalFlags: number;
    netFeedbackScore: number;
  }>> {
    return makeRequest<{
      newPulseScore: number;
      newConfidenceLevel: 'high' | 'medium' | 'low';
      totalFlags: number;
      netFeedbackScore: number;
    }>(`/api/sellers/${sellerId}/flag`, {
      method: 'DELETE',
    });
  }

  // Delete endorsement
  async deleteEndorsement(sellerId: string): Promise<ApiResponse<{
    newPulseScore: number;
    newConfidenceLevel: 'high' | 'medium' | 'low';
    totalEndorsements: number;
    netFeedbackScore: number;
  }>> {
    return makeRequest<{
      newPulseScore: number;
      newConfidenceLevel: 'high' | 'medium' | 'low';
      totalEndorsements: number;
      netFeedbackScore: number;
    }>(`/api/sellers/${sellerId}/endorse`, {
      method: 'DELETE',
    });
  }

  // Get seller by ID
  async getSellerById(sellerId: string): Promise<ApiResponse<{
    seller: Seller;
    extractedData?: any;
    scoringResult?: {
      pulseScore: number;
      confidenceLevel: 'high' | 'medium' | 'low';
      recommendations: Array<{
        type: string;
        message: string;
        action: string;
      }>;
      trustIndicators: {
        accountVerification: string;
        transactionHistory: string;
        communicationQuality: string;
        disputeResolution: string;
      };
      riskFactors: Array<string | {
        category?: string;
        severity?: string;
        issue: string;
      }>;
    };
  }>> {
    return makeRequest<{
      seller: Seller;
      extractedData?: any;
      scoringResult?: {
        pulseScore: number;
        confidenceLevel: 'high' | 'medium' | 'low';
        recommendations: Array<{
          type: string;
          message: string;
          action: string;
        }>;
        trustIndicators: {
          accountVerification: string;
          transactionHistory: string;
          communicationQuality: string;
          disputeResolution: string;
        };
        riskFactors: Array<string | {
          category?: string;
          severity?: string;
          issue: string;
        }>;
      };
    }>(`/api/sellers/${sellerId}`);
  }

  // Get current seller's profile
  async getMySellerProfile(): Promise<ApiResponse<{
    seller: Seller;
    extractedData?: any;
    scoringResult?: {
      pulseScore: number;
      confidenceLevel: 'high' | 'medium' | 'low';
      recommendations: Array<{
        type: string;
        message: string;
        action: string;
      }>;
      trustIndicators: {
        accountVerification: string;
        transactionHistory: string;
        communicationQuality: string;
        disputeResolution: string;
      };
      riskFactors: Array<string | {
        category?: string;
        severity?: string;
        issue: string;
      }>;
    };
  }>> {
    return makeRequest<{
      seller: Seller;
      extractedData?: any;
      scoringResult?: {
        pulseScore: number;
        confidenceLevel: 'high' | 'medium' | 'low';
        recommendations: Array<{
          type: string;
          message: string;
          action: string;
        }>;
        trustIndicators: {
          accountVerification: string;
          transactionHistory: string;
          communicationQuality: string;
          disputeResolution: string;
        };
        riskFactors: Array<string | {
          category?: string;
          severity?: string;
          issue: string;
        }>;
      };
    }>('/api/sellers/my-profile');
  }

  // Get user interactions
  async getMyInteractions(): Promise<ApiResponse<{
    interactions: {
      flagged: Array<{
        seller: {
          id: string;
          name: string;
          platform: string;
          pulseScore: number;
        };
        flag: {
          reason: string;
          timestamp: string;
          isVerified: boolean;
        };
      }>;
      endorsed: Array<{
        seller: {
          id: string;
          name: string;
          platform: string;
          pulseScore: number;
        };
        endorsement: {
          reason: string;
          timestamp: string;
          isVerified: boolean;
        };
      }>;
    };
    summary: {
      totalFlags: number;
      totalEndorsements: number;
      totalInteractions: number;
    };
  }>> {
    return makeRequest<{
      interactions: {
        flagged: Array<{
          seller: {
            id: string;
            name: string;
            platform: string;
            pulseScore: number;
          };
          flag: {
            reason: string;
            timestamp: string;
            isVerified: boolean;
          };
        }>;
        endorsed: Array<{
          seller: {
            id: string;
            name: string;
            platform: string;
            pulseScore: number;
          };
          endorsement: {
            reason: string;
            timestamp: string;
            isVerified: boolean;
          };
        }>;
      };
      summary: {
        totalFlags: number;
        totalEndorsements: number;
        totalInteractions: number;
      };
    }>('/api/users/my-interactions');
  }

  // Get user recent activity
  async getRecentActivity(): Promise<ApiResponse<{
    activities: Array<{
      type: 'extraction' | 'endorsement' | 'flag';
      timestamp: string;
      details: {
        seller: {
          id: string;
          name: string;
          platform: string;
          profileUrl: string;
          pulseScore: number;
        };
        pulseScoreAtExtraction?: number;
        reason?: string;
        isVerified?: boolean;
      };
    }>;
    summary: {
      total: number;
      byType: {
        extraction?: number;
        flag?: number;
        endorsement?: number;
      };
    };
    pagination: {
      limit: number;
      returned: number;
      total: number;
      hasMore: boolean;
    };
    timeRange: string;
  }>> {
    return makeRequest<{
      activities: Array<{
        type: 'extraction' | 'endorsement' | 'flag';
        timestamp: string;
        details: {
          seller: {
            id: string;
            name: string;
            platform: string;
            profileUrl: string;
            pulseScore: number;
          };
          pulseScoreAtExtraction?: number;
          reason?: string;
          isVerified?: boolean;
        };
      }>;
      summary: {
        total: number;
        byType: {
          extraction?: number;
          flag?: number;
          endorsement?: number;
        };
      };
      pagination: {
        limit: number;
        returned: number;
        total: number;
        hasMore: boolean;
      };
      timeRange: string;
    }>('/api/users/recent-activity');
  }

  // Get top threats
  async getTopThreats(): Promise<ApiResponse<{
    threats: Array<{
      sellerId: string;
      sellerName: string;
      platform: string;
      usersAffected: number;
      timeAgo: string;
      location: string;
      riskScore: number;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      description: string;
      lastScored: string;
      flagCount: number;
    }>;
    count: number;
    retrievedAt: string;
  }>> {
    return makeRequest<{
      threats: Array<{
        sellerId: string;
        sellerName: string;
        platform: string;
        usersAffected: number;
        timeAgo: string;
        location: string;
        riskScore: number;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
        description: string;
        lastScored: string;
        flagCount: number;
      }>;
      count: number;
      retrievedAt: string;
    }>('/api/users/threats/top');
  }

  // Get user extractions with time range
  async getMyExtractions(timeRange: '7d' | '30d' = '7d'): Promise<ApiResponse<{
    timeRange: string;
    sellers: Array<{
      id: string;
      sellerId: string;
      platform: string;
      profileUrl: string;
      profileData: {
        name: string;
        profilePicture: string | null;
        location: string;
        bio: string;
      };
      pulseScore: number;
      confidenceLevel: string;
      verificationStatus: string;
      extractedAt: string;
      createdAt: string;
    }>;
    metrics: {
      totalCount: number;
      totalCountChange: string;
      totalCountChangeValue: number;
      averagePulseScore: number;
      averagePulseScoreChange: string;
      averagePulseScoreChangeValue: number;
      highRiskCount: number;
      highRiskCountChange: string;
      highRiskCountChangeValue: number;
    };
    period: {
      current: {
        start: string;
        end: string;
      };
      previous: {
        start: string;
        end: string;
      };
    };
  }>> {
    return makeRequest<{
      timeRange: string;
      sellers: Array<{
        id: string;
        sellerId: string;
        platform: string;
        profileUrl: string;
        profileData: {
          name: string;
          profilePicture: string | null;
          location: string;
          bio: string;
        };
        pulseScore: number;
        confidenceLevel: string;
        verificationStatus: string;
        extractedAt: string;
        createdAt: string;
      }>;
      metrics: {
        totalCount: number;
        totalCountChange: string;
        totalCountChangeValue: number;
        averagePulseScore: number;
        averagePulseScoreChange: string;
        averagePulseScoreChangeValue: number;
        highRiskCount: number;
        highRiskCountChange: string;
        highRiskCountChangeValue: number;
      };
      period: {
        current: {
          start: string;
          end: string;
        };
        previous: {
          start: string;
          end: string;
        };
      };
    }>(`/api/users/my-extractions?timeRange=${timeRange}`);
  }
}

export const apiService = new ApiService();