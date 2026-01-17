import React, { useState, useEffect, useRef } from 'react';
import { apiService, type Seller } from '../services/api';
import { authService } from '../services/authService';
import Logo from './Logo';
import './Dashboard.css';

// Declare browser APIs
declare const chrome: any;
declare const browser: any;

interface MarketplaceSellerData {
  marketplace: string;
  sellerId: string;
  sellerName: string;
  profileUrl: string;
  trustScore: number;
}

interface DashboardProps {
  user: any;
  onLogout: () => void;
  pendingSellerAnalysis?: MarketplaceSellerData | null;
  onPendingSellerAnalysisHandled?: () => void;
}

interface Analysis {
  _id: string;
  sellerName: string;
  platform: string;
  score: number;
  riskLevel: 'Trusted' | 'Uncertain' | 'Avoid';
  timestamp: string;
  price?: string;
  location?: string;
}

type TabType = 'overview' | 'analyses' | 'history' | 'activity';
type SellerViewTab = 'top' | 'all';
type ActiveAction = 'analyze' | 'view-sellers' | 'reports' | null;
type ActivitySubTab = 'feedbacks' | 'interactions';

export default function Dashboard({ user, onLogout, pendingSellerAnalysis, onPendingSellerAnalysisHandled }: DashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  // Use user prop as initial state (comes from persisted auth data)
  const [currentUser, setCurrentUser] = useState<any>(user);

  // Update currentUser when user prop changes (from auth state updates)
  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    averageScore: 0,
    trustedCount: 0,
    avoidCount: 0
  });

  // New states for seller search and views
  const [sellerSearchUrl, setSellerSearchUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  // Ref to track if auto-detection has been attempted
  const hasAutoDetectedRef = useRef(false);
  const [showSellerView, setShowSellerView] = useState(false);
  const [sellerViewTab, setSellerViewTab] = useState<SellerViewTab>('top');
  const [topSellers, setTopSellers] = useState<Seller[]>([]);
  const [allSellers, setAllSellers] = useState<Seller[]>([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(false);

  // Become a seller states
  const [showBecomeSeller, setShowBecomeSeller] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [sellerProfileUrl, setSellerProfileUrl] = useState('');
  const [isSubmittingSeller, setIsSubmittingSeller] = useState(false);

  // Seller detail modal states
  const [showSellerDetail, setShowSellerDetail] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [isLoadingSellerDetail, setIsLoadingSellerDetail] = useState(false);
  const [sellerDetailData, setSellerDetailData] = useState<{
    seller: Seller;
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
  } | null>(null);

  // Flag seller modal states
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);

  // Endorse seller modal states
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorseReason, setEndorseReason] = useState('');
  const [isEndorsing, setIsEndorsing] = useState(false);

  // Global message modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageModalData, setMessageModalData] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // Global confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  // Activity sub-tab state
  const [activeActivitySubTab, setActiveActivitySubTab] = useState<ActivitySubTab>('feedbacks');

  // Reports/Extractions states
  const [extractionsTimeRange, setExtractionsTimeRange] = useState<'7d' | '30d'>('7d');
  const [extractionsData, setExtractionsData] = useState<{
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
  } | null>(null);
  const [isLoadingExtractions, setIsLoadingExtractions] = useState(false);

  // Threats states
  const [threatsData, setThreatsData] = useState<{
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
  } | null>(null);
  const [isLoadingThreats, setIsLoadingThreats] = useState(false);

  // Analyze search states
  const [analyzeSearchType, setAnalyzeSearchType] = useState<'url' | 'name-platform' | 'name-platform-location'>('url');
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzeName, setAnalyzeName] = useState('');
  const [analyzePlatform, setAnalyzePlatform] = useState('');
  const [analyzeLocation, setAnalyzeLocation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Search results modal states (for multiple sellers)
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResultsList, setSearchResultsList] = useState<Seller[]>([]);
  const [searchResultsPagination, setSearchResultsPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalSellers: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);

  // Settings modal states
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUserData, setSettingsUserData] = useState<any>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsFormData, setSettingsFormData] = useState({
    name: '',
  });

  // Seller dashboard states
  const [sellerProfile, setSellerProfile] = useState<Seller | null>(null);
  const [sellerScoringResult, setSellerScoringResult] = useState<any>(null);
  const [isLoadingSellerProfile, setIsLoadingSellerProfile] = useState(false);
  const [sellerActiveTab, setSellerActiveTab] = useState<'overview' | 'profile' | 'feedback'>('overview');

  // Feedback data states
  const [feedbackData, setFeedbackData] = useState<{
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
  } | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Interactions data states
  const [interactionsData, setInteractionsData] = useState<{
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
  } | null>(null);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);

  // Recent activity states
  const [recentActivity, setRecentActivity] = useState<{
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
  } | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Helper function to show message modal
  const showMessage = (type: 'success' | 'error', title: string, message: string, details?: string) => {
    setMessageModalData({ type, title, message, details });
    setShowMessageModal(true);
  };

  // Helper function to show confirmation modal
  const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setConfirmModalData({
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
    });
    setShowConfirmModal(true);
  };

  // Determine user role
  const userRole = currentUser?.role || user?.role || 'user';
  const isBuyer = userRole === 'user';
  const isSeller = userRole === 'seller';

  console.log("========>>>>", isSeller)
  // Periodically refresh user data while token is valid (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const refreshUserData = async () => {
      try {
        const response = await apiService.getCurrentUser();
        if (response.success && response.data) {
          setCurrentUser(response.data);
          // Update stored auth data with fresh user info
          try {
            await authService.updateUserData(response.data);
          } catch (err) {
            console.warn('Failed to update stored user data:', err);
          }
        }
      } catch (err) {
        console.error('Error refreshing user data:', err);
        // Keep current user data if refresh fails
      }
    };

    // Refresh immediately on mount (only once)
    const initialRefresh = setTimeout(() => {
      refreshUserData();
    }, 1000); // Small delay to avoid blocking initial render

    // Then refresh periodically every 5 minutes
    const refreshInterval = setInterval(refreshUserData, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialRefresh);
      clearInterval(refreshInterval);
    };
  }, [user]);

  // Fetch user details when settings modal opens
  useEffect(() => {
    if (showSettings) {
      const fetchSettingsData = async () => {
        setIsLoadingSettings(true);
        try {
          const response = await apiService.getCurrentUser();
          if (response.success && response.data) {
            setSettingsUserData(response.data);
            setSettingsFormData({ name: response.data.name || '' });
          } else {
            showMessage('error', 'Error', response.error || 'Failed to load user details.');
            setShowSettings(false);
          }
        } catch (err: any) {
          console.error('Error fetching user details:', err);
          showMessage('error', 'Error', 'An error occurred while loading user details.');
          setShowSettings(false);
        } finally {
          setIsLoadingSettings(false);
        }
      };

      fetchSettingsData();
    }
  }, [showSettings]);

  // Fetch seller profile data on mount (only for sellers)
  const fetchSellerProfile = async () => {
    if (!isSeller) return;

    setIsLoadingSellerProfile(true);
    try {
      const response = await apiService.getMySellerProfile();
      if (response.success && response.data) {
        setSellerProfile(response.data.seller);
        setSellerScoringResult(response.data.scoringResult);
      } else {
        showMessage('error', 'Error', response.error || 'Failed to load seller profile.');
      }
    } catch (err: any) {
      console.error('Error fetching seller profile:', err);
      showMessage('error', 'Error', 'An error occurred while loading seller profile.');
    } finally {
      setIsLoadingSellerProfile(false);
      setIsLoading(false);
    }
  };

  // Handle pending seller analysis from badge click
  useEffect(() => {
    if (pendingSellerAnalysis && isBuyer) {
      const handlePendingAnalysis = async () => {
        try {
          setIsLoadingSellerDetail(true);
          setShowSellerDetail(true);

          // Use the simplified seller data directly
          const sellerData = pendingSellerAnalysis;
          const synthesizedSeller: Seller = {
              _id: sellerData.sellerId,
              sellerId: sellerData.sellerId,
              platform: sellerData.marketplace,
              profileUrl: sellerData.profileUrl,
              pulseScore: sellerData.trustScore,
              confidenceLevel: 'medium' as const,
              verificationStatus: 'unknown',
              isActive: true,
              isClaimed: false,
              profileData: {
                name: sellerData.sellerName,
                profilePicture: null,
                location: '',
                bio: ''
              },
              marketplaceData: {
                accountAge: 0,
                totalListings: 0,
                avgRating: 0,
                totalReviews: 0,
                responseRate: 0,
                verificationStatus: 'unknown',
                followers: 0,
                categories: []
              }
            };

          // Modal UI renders off `selectedSeller`
          setSelectedSeller(synthesizedSeller);

          setSellerDetailData({
            seller: synthesizedSeller,
            scoringResult: {
              pulseScore: sellerData.trustScore,
              confidenceLevel: 'medium' as const,
              recommendations: [{
                type: 'trust',
                message: `Trust score: ${sellerData.trustScore}/100`,
                action: 'Proceed with caution'
              }],
              trustIndicators: {
                accountVerification: 'unknown',
                transactionHistory: 'unknown',
                communicationQuality: 'unknown',
                disputeResolution: 'unknown'
              },
              riskFactors: []
            }
          });

          setIsLoadingSellerDetail(false);

          // Notify parent that we've handled the pending analysis
          if (onPendingSellerAnalysisHandled) {
            onPendingSellerAnalysisHandled();
          }
        } catch (error) {
          console.error('Error handling pending seller analysis:', error);
          setIsLoadingSellerDetail(false);
          if (onPendingSellerAnalysisHandled) {
            onPendingSellerAnalysisHandled();
          }
        }
      };

      handlePendingAnalysis();
    }
  }, [pendingSellerAnalysis, isBuyer, onPendingSellerAnalysisHandled]);

  // Fetch dashboard data on mount (only for buyers)
  useEffect(() => {
    if (isBuyer) {
      fetchDashboardData();
    } else if (isSeller) {
      fetchSellerProfile();
    } else {
      setIsLoading(false);
    }
  }, [isBuyer, isSeller]);

  // Fetch feedback data when feedbacks tab is active
  useEffect(() => {
    if (isBuyer && activeTab === 'activity' && activeActivitySubTab === 'feedbacks') {
      fetchFeedbackData();
    }
  }, [isBuyer, activeTab, activeActivitySubTab]);

  // Fetch interactions data when interactions tab is active
  useEffect(() => {
    if (isBuyer && activeTab === 'activity' && activeActivitySubTab === 'interactions') {
      fetchInteractionsData();
    }
  }, [isBuyer, activeTab, activeActivitySubTab]);

  // Fetch recent activity data when history tab is active
  const fetchExtractions = async (timeRange: '7d' | '30d') => {
    if (!isBuyer) return;

    setIsLoadingExtractions(true);
    setError('');

    try {
      const response = await apiService.getMyExtractions(timeRange);

      if (response.success && response.data) {
        setExtractionsData({
          sellers: response.data.sellers,
          metrics: response.data.metrics
        });
      } else {
        setExtractionsData(null);
        showMessage('error', 'Error', response.error || 'Failed to load extractions.');
      }
    } catch (error: any) {
      console.error('Error fetching extractions:', error);
      setExtractionsData(null);
      showMessage('error', 'Error', 'Failed to load extractions. Please try again.');
    } finally {
      setIsLoadingExtractions(false);
    }
  };

  const fetchRecentActivity = async () => {
    if (!isBuyer) return;

    setIsLoadingActivity(true);
    setError('');

    try {
      const response = await apiService.getRecentActivity();

      if (response.success && response.data) {
        setRecentActivity(response.data);
      } else {
        showMessage('error', 'Error', response.error || 'Failed to load recent activity.');
      }
    } catch (error: any) {
      console.error('Error fetching recent activity:', error);
      showMessage('error', 'Error', 'Failed to load recent activity. Please try again.');
    } finally {
      setIsLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (isBuyer && activeTab === 'history') {
      fetchRecentActivity();
    }
  }, [isBuyer, activeTab]);

  // Fetch extractions when reports action is opened or time range changes
  useEffect(() => {
    if (isBuyer && activeAction === 'reports') {
      fetchExtractions(extractionsTimeRange);
    }
  }, [isBuyer, activeAction, extractionsTimeRange]);

  // Fetch threats when analyses tab is active
  const fetchThreats = async () => {
    if (!isBuyer) return;

    setIsLoadingThreats(true);
    setError('');

    try {
      const response = await apiService.getTopThreats();

      if (response.success && response.data) {
        setThreatsData({
          threats: response.data.threats,
          count: response.data.count
        });
      } else {
        setThreatsData(null);
        showMessage('error', 'Error', response.error || 'Failed to load threats.');
      }
    } catch (error: any) {
      console.error('Error fetching threats:', error);
      setThreatsData(null);
      showMessage('error', 'Error', 'Failed to load threats. Please try again.');
    } finally {
      setIsLoadingThreats(false);
    }
  };

  useEffect(() => {
    if (isBuyer && activeTab === 'analyses') {
      fetchThreats();
    }
  }, [isBuyer, activeTab]);

  // Auto-detect seller profile when component mounts or when overview tab is active
  useEffect(() => {
    if (isBuyer && activeTab === 'overview' && !isSearching && !sellerSearchUrl.trim() && !hasAutoDetectedRef.current) {
      // Get current active tab URL
      const getCurrentTabUrl = async (): Promise<string | null> => {
        try {
          const chromeApi = (window as any).chrome || (globalThis as any).chrome;
          const browserApi = (window as any).browser || (globalThis as any).browser;
          
          if (chromeApi && chromeApi.tabs) {
            return new Promise((resolve) => {
              chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
                if (tabs && tabs[0] && tabs[0].url) {
                  resolve(tabs[0].url);
                } else {
                  resolve(null);
                }
              });
            });
          } else if (browserApi && browserApi.tabs) {
            return new Promise((resolve) => {
              browserApi.tabs.query({ active: true, currentWindow: true }).then((tabs: any[]) => {
                if (tabs && tabs[0] && tabs[0].url) {
                  resolve(tabs[0].url);
                } else {
                  resolve(null);
                }
              });
            });
          }
        } catch (error) {
          console.error('Error getting current tab URL:', error);
        }
        return null;
      };

      // Check if URL is a seller profile URL (only supported marketplaces)
      const isSellerProfileUrl = (url: string): boolean => {
        if (!url) return false;
        const urlLower = url.toLowerCase();
        const patterns = [
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
        return patterns.some(pattern => pattern.test(urlLower));
      };

      // Auto-detect and search
      const autoDetect = async () => {
        try {
          hasAutoDetectedRef.current = true;
          const currentUrl = await getCurrentTabUrl();
          if (currentUrl && isSellerProfileUrl(currentUrl)) {
            setSellerSearchUrl(currentUrl);
            // Pass URL directly to avoid state update timing issues
            handleSellerSearch(currentUrl);
          }
        } catch (error) {
          console.error('Error auto-detecting seller profile:', error);
        }
      };

      autoDetect();
    }
  }, [isBuyer, activeTab, isSearching, sellerSearchUrl]);

  const fetchDashboardData = async () => {
    if (!isBuyer) return;

    setIsLoading(true);
    setError('');

    try {
      // const recentResponse = await apiService.getRecentAnalyses(10);

      // if (recentResponse.success && recentResponse.data) {
      //   setRecentAnalyses(recentResponse.data);

      //   if (recentResponse.data.length > 0) {
      //     setCurrentAnalysis(recentResponse.data[0]);
      //   }
      // }

      // const historyResponse = await apiService.getAnalysisHistory(100);

      // if (historyResponse.success && historyResponse.data) {
      //   const analyses = historyResponse.data.analyses;
      //   setStats({
      //     totalAnalyses: historyResponse.data.total || analyses.length,
      //     averageScore: analyses.length > 0
      //       ? Math.round(analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length)
      //       : 0,
      //     trustedCount: analyses.filter(a => a.riskLevel === 'Trusted').length,
      //     avoidCount: analyses.filter(a => a.riskLevel === 'Avoid').length
      //   });
      // }

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedbackData = async () => {
    if (!isBuyer) return;

    setIsLoadingFeedback(true);
    setError('');

    try {
      const response = await apiService.getMyFeedback();

      if (response.success && response.data) {
        setFeedbackData(response.data);
      } else {
        showMessage('error', 'Error', response.error || 'Failed to load feedback data.');
      }
    } catch (error: any) {
      console.error('Error fetching feedback data:', error);
      showMessage('error', 'Error', 'Failed to load feedback data. Please try again.');
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const fetchInteractionsData = async () => {
    if (!isBuyer) return;

    setIsLoadingInteractions(true);
    setError('');

    try {
      const response = await apiService.getMyInteractions();

      if (response.success && response.data) {
        setInteractionsData(response.data);
      } else {
        showMessage('error', 'Error', response.error || 'Failed to load interactions data.');
      }
    } catch (error: any) {
      console.error('Error fetching interactions data:', error);
      showMessage('error', 'Error', 'Failed to load interactions data. Please try again.');
    } finally {
      setIsLoadingInteractions(false);
    }
  };

  const handleDeleteAccount = async () => {
    showConfirmation(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      async () => {
        setShowConfirmModal(false);
        setIsLoading(true);
        setError('');

        try {
          const response = await apiService.deleteUser();

          if (response.success) {
            onLogout();
          } else {
            setError(response.error || 'Failed to delete account. Please try again.');
            showMessage('error', 'Delete Failed', response.error || 'Failed to delete account. Please try again.');
          }
        } catch (error: any) {
          setError('An unexpected error occurred. Please try again.');
          showMessage('error', 'Error', 'An unexpected error occurred. Please try again.');
          console.error('Delete account error:', error);
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setShowConfirmModal(false);
      },
      'Delete Account',
      'Cancel'
    );
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getScoreClass = (score: number) => {
    if (score >= 90) return 'very-high';
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  };

  const getRiskBadgeClass = (riskLevel: string) => {
    if (riskLevel === 'Trusted') return 'trusted';
    if (riskLevel === 'Uncertain') return 'uncertain';
    return 'avoid';
  };

  const getPlatformIcon = (platform: string) => {
    if (platform.toLowerCase().includes('facebook')) return '📘';
    if (platform.toLowerCase().includes('jiji')) return '🛒';
    if (platform.toLowerCase().includes('craigslist')) return '📋';
    if (platform.toLowerCase().includes('offerup')) return '📦';
    return '🏪';
  };

  // Get current active tab URL
  const getCurrentTabUrl = async (): Promise<string | null> => {
    try {
      const chromeApi = (window as any).chrome || (globalThis as any).chrome;
      const browserApi = (window as any).browser || (globalThis as any).browser;
      
      if (chromeApi && chromeApi.tabs) {
        return new Promise((resolve) => {
          chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
            if (tabs && tabs[0] && tabs[0].url) {
              resolve(tabs[0].url);
            } else {
              resolve(null);
            }
          });
        });
      } else if (browserApi && browserApi.tabs) {
        return new Promise((resolve) => {
          browserApi.tabs.query({ active: true, currentWindow: true }).then((tabs: any[]) => {
            if (tabs && tabs[0] && tabs[0].url) {
              resolve(tabs[0].url);
            } else {
              resolve(null);
            }
          });
        });
      }
    } catch (error) {
      console.error('Error getting current tab URL:', error);
    }
    return null;
  };

  // Check if URL is a seller profile URL
  const isSellerProfileUrl = (url: string): boolean => {
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    
    // Check for common marketplace seller profile patterns
    const patterns = [
      /jiji\.ng\/sellerpage/,
      /jiji\.ng\/shop/,
      /facebook\.com\/marketplace\/profile/,
      /facebook\.com\/.*\/marketplace/,
      /etsy\.com\/shop/,
      /craigslist\.org\/.*\/.*\.html/,
      /offerup\.com\/user/,
      /offerup\.com\/profile/
    ];
    
    return patterns.some(pattern => pattern.test(urlLower));
  };

  // Auto-detect and search seller profile from current tab
  const autoDetectAndSearch = async () => {
    if (isSearching || sellerSearchUrl.trim()) return; // Don't auto-search if already searching or has URL
    
    try {
      const currentUrl = await getCurrentTabUrl();
      
      if (currentUrl && isSellerProfileUrl(currentUrl)) {
        // Set the URL and automatically search
        setSellerSearchUrl(currentUrl);
        // Small delay to ensure state is updated
        setTimeout(() => {
          handleSellerSearch();
        }, 100);
      }
    } catch (error) {
      console.error('Error auto-detecting seller profile:', error);
    }
  };

  // Handle seller URL search
  const handleSellerSearch = async (urlOverride?: string) => {
    const urlToSearch = urlOverride || sellerSearchUrl;
    
    if (!urlToSearch.trim()) {
      setError('Please enter a seller profile URL');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await apiService.extractSellerProfile(urlToSearch.trim());

      if (response.success && response.data) {
        setSearchResults(response.data);
        // Show search results in a modal or dedicated view
        setActiveTab('overview');
      } else {
        showMessage(
          'error',
          'Search Failed',
          response.error || 'Failed to extract seller profile. Please check the URL and try again.'
        );
      }
    } catch (err: any) {
      console.error('Seller search error:', err);
      showMessage('error', 'Search Error', 'An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Load sellers for View Sellers tab
  const loadSellers = async (tab: SellerViewTab) => {
    setIsLoadingSellers(true);
    setError('');

    try {
      if (tab === 'top') {
        const response = await apiService.getTopSellers(10);
        if (response.success && response.data) {
          setTopSellers(response.data.sellers || []);
        }
      } else {
        const response = await apiService.getAllSellers(20, 0);
        if (response.success && response.data) {
          setAllSellers(response.data.sellers || []);
        }
      }
    } catch (err: any) {
      console.error('Error loading sellers:', err);
      showMessage('error', 'Loading Error', 'Failed to load sellers. Please try again.');
    } finally {
      setIsLoadingSellers(false);
    }
  };

  // Handle seller actions
  const handleViewSeller = async (seller: Seller) => {
    setIsLoadingSellerDetail(true);
    setShowSellerDetail(true);
    setSelectedSeller(seller); // Set temporarily while loading
    setSellerDetailData(null);

    try {
      const response = await apiService.getSellerById(seller._id);

      if (response.success && response.data) {
        setSelectedSeller(response.data.seller);
        setSellerDetailData({
          seller: response.data.seller,
          scoringResult: response.data.scoringResult,
        });
      } else {
        showMessage('error', 'Error', response.error || 'Failed to load seller details. Please try again.');
        setShowSellerDetail(false);
        setSelectedSeller(null);
        setSellerDetailData(null);
      }
    } catch (err: any) {
      console.error('Error fetching seller details:', err);
      showMessage('error', 'Error', 'An error occurred while loading seller details. Please try again.');
      setShowSellerDetail(false);
      setSelectedSeller(null);
      setSellerDetailData(null);
    } finally {
      setIsLoadingSellerDetail(false);
    }
  };

  const handleFlagSeller = (seller: Seller) => {
    setSelectedSeller(seller);
    setShowFlagModal(true);
    setFlagReason('');
  };

  const handleSubmitFlag = async () => {
    if (!selectedSeller || !flagReason.trim()) {
      setError('Please provide a reason for flagging this seller');
      return;
    }

    setIsFlagging(true);
    setError('');

    try {
      const response = await apiService.flagSeller(selectedSeller._id, flagReason.trim());

      if (response.success && response.data) {
        const { newPulseScore, newConfidenceLevel, totalFlags, netFeedbackScore } = response.data;
        setMessageModalData({
          type: 'success',
          title: 'Seller Flagged Successfully',
          message: response.message || 'Seller has been flagged successfully.',
          details: `New Pulse Score: ${newPulseScore}/100\nConfidence Level: ${newConfidenceLevel}\nTotal Flags: ${totalFlags}\nNet Feedback Score: ${netFeedbackScore > 0 ? '+' : ''}${netFeedbackScore}`
        });
        setShowMessageModal(true);
        setShowFlagModal(false);
        setShowSellerDetail(false);
        setFlagReason('');
        setSelectedSeller(null);

        // Refresh sellers list if needed
        if (activeAction === 'view-sellers') {
          loadSellers(sellerViewTab);
        }
      } else {
        setMessageModalData({
          type: 'error',
          title: 'Flag Failed',
          message: response.error || 'Failed to flag seller. Please try again.'
        });
        setShowMessageModal(true);
      }
    } catch (err: any) {
      console.error('Flag seller error:', err);
      setMessageModalData({
        type: 'error',
        title: 'Error',
        message: 'An error occurred while flagging the seller. Please try again.'
      });
      setShowMessageModal(true);
    } finally {
      setIsFlagging(false);
    }
  };

  const handleEndorseSeller = (seller: Seller) => {
    setSelectedSeller(seller);
    setShowEndorseModal(true);
    setEndorseReason('');
  };

  const handleSubmitEndorse = async () => {
    if (!selectedSeller || !endorseReason.trim()) {
      setError('Please provide a reason for endorsing this seller');
      return;
    }

    setIsEndorsing(true);
    setError('');

    try {
      const response = await apiService.endorseSeller(selectedSeller._id, endorseReason.trim());

      if (response.success && response.data) {
        const { newPulseScore, newConfidenceLevel, totalEndorsements, netFeedbackScore } = response.data;
        setMessageModalData({
          type: 'success',
          title: 'Seller Endorsed Successfully',
          message: response.message || 'Seller has been endorsed successfully.',
          details: `New Pulse Score: ${newPulseScore}/100\nConfidence Level: ${newConfidenceLevel}\nTotal Endorsements: ${totalEndorsements}\nNet Feedback Score: ${netFeedbackScore > 0 ? '+' : ''}${netFeedbackScore}`
        });
        setShowMessageModal(true);
        setShowEndorseModal(false);
        setShowSellerDetail(false);
        setSelectedSeller(null);

        // Refresh sellers list if needed
        if (activeAction === 'view-sellers') {
          loadSellers(sellerViewTab);
        }
      } else {
        setMessageModalData({
          type: 'error',
          title: 'Endorsement Failed',
          message: response.error || 'Failed to endorse seller. Please try again.'
        });
        setShowMessageModal(true);
      }
    } catch (err: any) {
      console.error('Endorse seller error:', err);
      setMessageModalData({
        type: 'error',
        title: 'Error',
        message: 'An error occurred while endorsing the seller. Please try again.'
      });
      setShowMessageModal(true);
    } finally {
      setIsEndorsing(false);
    }
  };

  // Get score class based on pulseScore
  const getPulseScoreClass = (score: number) => {
    if (score >= 90) return 'very-high';
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  };

  // Get confidence badge class
  const getConfidenceClass = (level: string) => {
    if (level === 'high') return 'high';
    if (level === 'medium') return 'medium';
    return 'low';
  };

  // Clean seller name - remove markdown, URLs, and clean up messy data
  const cleanSellerName = (name: string | null | undefined): string => {
    if (!name) return 'Unknown Seller';

    // Remove markdown image syntax: ![alt](url)
    let cleaned = name.replace(/!\[.*?\]\(.*?\)/g, '').trim();

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '').trim();

    // Remove markdown links: [text](url)
    cleaned = cleaned.replace(/\[.*?\]\(.*?\)/g, '').trim();

    // Remove trailing backslashes and escape characters
    cleaned = cleaned.replace(/\\+$/, '').trim();
    cleaned = cleaned.replace(/\\/g, ' ').trim();

    // Remove leading/trailing special characters like \, /, -, _
    cleaned = cleaned.replace(/^[\\\/\-\_]+|[\\\/\-\_]+$/g, '').trim();

    // Remove patterns like "135m", "2ads", "226ads" (numbers followed by letters at the end)
    cleaned = cleaned.replace(/\b\d+[a-z]+\b/gi, '').trim();

    // Remove standalone numbers
    cleaned = cleaned.replace(/^\d+\s*$/, '').trim();

    // Remove multiple dots, dashes, underscores
    cleaned = cleaned.replace(/[\.]{2,}/g, '').trim();
    cleaned = cleaned.replace(/[\-]{2,}/g, '-').trim();
    cleaned = cleaned.replace(/[\_]{2,}/g, '_').trim();

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove common garbage patterns
    cleaned = cleaned.replace(/^item to buy/i, '').trim();
    cleaned = cleaned.replace(/^seller\s*$/i, '').trim();
    cleaned = cleaned.replace(/^ads?\s*$/i, '').trim();

    // If the cleaned name is empty or too short, or looks like it's just a URL/image reference
    if (!cleaned || cleaned.length < 2 || cleaned.match(/^[!\[\]()\\\/]+$/)) {
      return 'Unknown Seller';
    }

    // If it looks like it's still markdown or URL remnants, use placeholder
    if (cleaned.includes('http') || cleaned.includes('www.') || cleaned.match(/^[^\w\s]+$/)) {
      return 'Unknown Seller';
    }

    // If it's mostly numbers or special characters, use placeholder
    const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 2 && cleaned.length > 3) {
      return 'Unknown Seller';
    }

    // Final trim
    cleaned = cleaned.trim();

    // Final check - if it's still too short or invalid
    if (cleaned.length < 2) {
      return 'Unknown Seller';
    }

    return cleaned;
  };

  // Clean category name - remove markdown, URLs, and clean up messy data
  const cleanCategoryName = (name: string | null | undefined): string | null => {
    if (!name) return null;

    // Remove markdown image syntax: ![alt](url)
    let cleaned = name.replace(/!\[.*?\]\(.*?\)/g, '').trim();

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '').trim();

    // Remove markdown links: [text](url)
    cleaned = cleaned.replace(/\[.*?\]\(.*?\)/g, '').trim();

    // Remove trailing backslashes and escape characters
    cleaned = cleaned.replace(/\\+$/, '').trim();
    cleaned = cleaned.replace(/\\/g, ' ').trim();

    // Remove leading/trailing special characters
    cleaned = cleaned.replace(/^[\\\/\-\_]+|[\\\/\-\_]+$/g, '').trim();

    // Remove patterns like "17ads", "226ads" (numbers followed by letters at the end)
    cleaned = cleaned.replace(/\b\d+[a-z]+\b/gi, '').trim();

    // Remove standalone numbers
    cleaned = cleaned.replace(/^\d+\s*$/, '').trim();

    // Remove multiple dots, dashes, underscores
    cleaned = cleaned.replace(/[\.]{2,}/g, '').trim();
    cleaned = cleaned.replace(/[\-]{2,}/g, '-').trim();
    cleaned = cleaned.replace(/[\_]{2,}/g, '_').trim();

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If the cleaned name is empty or too short, or looks like it's just a URL/image reference
    if (!cleaned || cleaned.length < 2 || cleaned.match(/^[!\[\]()\\\/]+$/)) {
      return null; // Return null to filter out invalid categories
    }

    // If it looks like it's still markdown or URL remnants, filter out
    if (cleaned.includes('http') || cleaned.includes('www.') || cleaned.match(/^[^\w\s]+$/)) {
      return null;
    }

    // If it's mostly numbers or special characters, filter out
    const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 2 && cleaned.length > 3) {
      return null;
    }

    return cleaned.trim();
  };

  // Get initials from cleaned name
  const getInitials = (name: string): string => {
    const cleaned = cleanSellerName(name);
    if (cleaned === 'Unknown Seller') return '?';

    // Extract only letters from the cleaned name
    const lettersOnly = cleaned.replace(/[^a-zA-Z\s]/g, ' ').trim();
    const words = lettersOnly.split(' ').filter(word => word.length > 0 && /[a-zA-Z]/.test(word));

    if (words.length === 0) return '?';

    if (words.length === 1) {
      const firstLetter = words[0].match(/[a-zA-Z]/);
      return firstLetter ? firstLetter[0].toUpperCase() : '?';
    }

    // Get first letter of first and last word
    const firstWordLetter = words[0].match(/[a-zA-Z]/);
    const lastWordLetter = words[words.length - 1].match(/[a-zA-Z]/);

    if (firstWordLetter && lastWordLetter) {
      return (firstWordLetter[0] + lastWordLetter[0]).toUpperCase();
    }

    return '?';
  };

  // Clean profile picture URL - filter out GIFs and invalid images
  const cleanProfilePicture = (url: string | null | undefined): string | null => {
    if (!url) return null;

    // Remove markdown image syntax if present
    let cleaned = url.replace(/!\[.*?\]\(/g, '').replace(/\)$/, '').trim();

    // Filter out GIFs
    if (cleaned.toLowerCase().includes('.gif')) {
      return null;
    }

    // Filter out common broken/default images
    if (cleaned.match(/tre\.gif/i) || cleaned.includes('tre.gif')) {
      return null;
    }

    // Filter out URLs that look like they're not actual images
    if (!cleaned.match(/\.(jpg|jpeg|png|webp|svg)$/i) && !cleaned.includes('picture') && !cleaned.includes('image')) {
      // If it doesn't look like an image URL, return null
      if (cleaned.length < 10 || !cleaned.startsWith('http')) {
        return null;
      }
    }

    return cleaned;
  };

  // Generate a consistent color based on name
  const getAvatarColor = (name: string): string => {
    const cleaned = cleanSellerName(name);
    const hash = cleaned.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    // Generate a pastel color
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  // Handle image load error - show initials instead
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, name: string) => {
    const target = e.target as HTMLImageElement;
    const parent = target.parentElement;
    if (parent) {
      parent.innerHTML = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'seller-avatar-placeholder';
      placeholder.style.backgroundColor = getAvatarColor(name);
      placeholder.textContent = getInitials(name);
      parent.appendChild(placeholder);
    }
  };

  // Handle View Sellers button click
  const handleViewSellers = () => {
    setActiveAction('view-sellers');
    setShowSellerView(true);
    loadSellers(sellerViewTab);
  };

  // Handle Analyze button click
  const handleAnalyze = () => {
    setActiveAction('analyze');
  };

  // Handle Reports button click
  const handleReports = () => {
    setActiveAction('reports');
  };

  // Handle analyze search
  const handleAnalyzeSearch = async () => {
    // Validation
    if (analyzeSearchType === 'url' && !analyzeUrl.trim()) {
      showMessage('error', 'Validation Error', 'Please enter a profile URL');
      return;
    }
    if (analyzeSearchType === 'name-platform' && (!analyzeName.trim() || !analyzePlatform)) {
      showMessage('error', 'Validation Error', 'Please enter seller name and select platform');
      return;
    }
    if (analyzeSearchType === 'name-platform-location' && (!analyzeName.trim() || !analyzePlatform || !analyzeLocation.trim())) {
      showMessage('error', 'Validation Error', 'Please fill in all fields');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      if (analyzeSearchType === 'url') {
        // Search by URL
        const response = await apiService.extractSellerProfile(analyzeUrl.trim());

        console.log('Extract seller profile response:', response);

        if (response.success && response.data) {
          // Extract seller and scoring result from response
          const sellerData = response.data.seller;
          const scoringResult = response.data.scoringResult;

          // Validate that seller data exists
          if (!sellerData) {
            console.error('Seller data is missing from response:', response.data);
            showMessage('error', 'Analysis Failed', 'Seller data not found in response. Please try again.');
            return;
          }

          // Validate required seller fields - ensure profileData exists or create a default structure
          if (!sellerData.profileData) {
            console.warn('Profile data missing, creating default structure');
            sellerData.profileData = {
              name: 'Unknown Seller',
              profilePicture: null,
              location: 'Not specified',
              bio: ''
            };
          }

          // Ensure marketplaceData exists
          if (!sellerData.marketplaceData) {
            console.warn('Marketplace data missing, creating default structure');
            sellerData.marketplaceData = {
              accountAge: 0,
              totalListings: 0,
              avgRating: 0,
              totalReviews: 0,
              responseRate: 0,
              verificationStatus: 'unverified',
              followers: 0,
              categories: []
            };
          }

          // Ensure required fields exist
          if (!sellerData._id) {
            console.error('Seller ID is missing:', sellerData);
            showMessage('error', 'Analysis Failed', 'Invalid seller data received. Please try again.');
            return;
          }

          // Set all state synchronously
          setSelectedSeller(sellerData);
          setSellerDetailData({
            seller: sellerData,
            scoringResult: scoringResult,
          });
          setIsLoadingSellerDetail(false);
          setShowSellerDetail(true);

          // Clear form
          setAnalyzeUrl('');
          setActiveAction(null);
        } else {
          console.error('Extract seller profile failed:', response);
          showMessage('error', 'Analysis Failed', response.error || 'Failed to analyze seller. Please check the URL and try again.');
        }
      } else if (analyzeSearchType === 'name-platform') {
        // Search by name and platform
        const response = await apiService.lookupSellerByNamePlatform(analyzeName.trim(), analyzePlatform);

        if (response.success && response.data) {
          // Use the seller data from response
          const sellerData = response.data.seller;

          // Fetch full seller details with scoring result
          try {
            const detailResponse = await apiService.getSellerById(sellerData._id);

            if (detailResponse.success && detailResponse.data) {
              // Set seller detail data with scoring result
              setIsLoadingSellerDetail(false);
              setSelectedSeller(detailResponse.data.seller);
              setSellerDetailData({
                seller: detailResponse.data.seller,
                scoringResult: detailResponse.data.scoringResult,
              });
              setShowSellerDetail(true);
            } else {
              // Fallback: use the seller data from lookup without scoring result
              setIsLoadingSellerDetail(false);
              setSelectedSeller(sellerData);
              setSellerDetailData({
                seller: sellerData,
                scoringResult: undefined,
              });
              setShowSellerDetail(true);
            }
          } catch (err) {
            // Fallback: use the seller data from lookup without scoring result
            setIsLoadingSellerDetail(false);
            setSelectedSeller(sellerData);
            setSellerDetailData({
              seller: sellerData,
              scoringResult: undefined,
            });
            setShowSellerDetail(true);
          }

          // Clear form
          setAnalyzeName('');
          setAnalyzePlatform('');
          setActiveAction(null);
        } else {
          setIsLoadingSellerDetail(false);
          showMessage('error', 'Search Failed', response.error || 'Failed to find seller. Please check the name and platform and try again.');
        }
      } else if (analyzeSearchType === 'name-platform-location') {
        // Search by name, platform and location
        const response = await apiService.searchSellersByNamePlatformLocation(
          analyzeName.trim(),
          analyzePlatform,
          analyzeLocation.trim()
        );

        if (response.success && response.data) {
          const sellers = response.data.sellers;
          const pagination = response.data.pagination;

          if (sellers.length === 0) {
            setIsLoadingSellerDetail(false);
            showMessage('error', 'No Results', 'No sellers found matching your search criteria.');
          } else if (sellers.length === 1) {
            // Single result - show directly in seller detail modal
            const sellerData = sellers[0];

            // Fetch full seller details with scoring result
            try {
              const detailResponse = await apiService.getSellerById(sellerData._id);

              if (detailResponse.success && detailResponse.data) {
                setIsLoadingSellerDetail(false);
                setSelectedSeller(detailResponse.data.seller);
                setSellerDetailData({
                  seller: detailResponse.data.seller,
                  scoringResult: detailResponse.data.scoringResult,
                });
                setShowSellerDetail(true);
              } else {
                // Fallback: use the seller data from search without scoring result
                setIsLoadingSellerDetail(false);
                setSelectedSeller(sellerData);
                setSellerDetailData({
                  seller: sellerData,
                  scoringResult: undefined,
                });
                setShowSellerDetail(true);
              }
            } catch (err) {
              // Fallback: use the seller data from search without scoring result
              setIsLoadingSellerDetail(false);
              setSelectedSeller(sellerData);
              setSellerDetailData({
                seller: sellerData,
                scoringResult: undefined,
              });
              setShowSellerDetail(true);
            }

            // Clear form
            setAnalyzeName('');
            setAnalyzePlatform('');
            setAnalyzeLocation('');
            setActiveAction(null);
          } else {
            // Multiple results - show list for user to select
            setSearchResultsList(sellers);
            setSearchResultsPagination(pagination);
            setShowSearchResults(true);

            // Clear form
            setAnalyzeName('');
            setAnalyzePlatform('');
            setAnalyzeLocation('');
            setActiveAction(null);
          }
        } else {
          setIsLoadingSellerDetail(false);
          showMessage('error', 'Search Failed', response.error || 'Failed to search sellers. Please check your inputs and try again.');
        }
      }
    } catch (err: any) {
      console.error('Analyze search error:', err);
      showMessage('error', 'Error', 'An error occurred while analyzing. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Become A Seller submission
  // Handle delete flag
  const handleDeleteFlag = async (sellerId: string) => {
    showConfirmation(
      'Delete Flag',
      'Are you sure you want to delete this flag? This action cannot be undone.',
      async () => {
        setShowConfirmModal(false);

        try {
          const response = await apiService.deleteFlag(sellerId);

          if (response.success && response.data) {
            const { newPulseScore, newConfidenceLevel, totalFlags, netFeedbackScore } = response.data;
            showMessage(
              'success',
              'Flag Deleted',
              response.message || 'Flag has been deleted successfully.',
              `New Pulse Score: ${newPulseScore}/100\nConfidence Level: ${newConfidenceLevel}\nTotal Flags: ${totalFlags}\nNet Feedback Score: ${netFeedbackScore > 0 ? '+' : ''}${netFeedbackScore}`
            );
            // Refresh feedback data if on feedbacks tab
            if (activeActivitySubTab === 'feedbacks') {
              fetchFeedbackData();
            }
            // Refresh interactions data if on interactions tab
            if (activeActivitySubTab === 'interactions') {
              fetchInteractionsData();
            }
          } else {
            showMessage('error', 'Delete Failed', response.error || 'Failed to delete flag. Please try again.');
          }
        } catch (err: any) {
          console.error('Delete flag error:', err);
          showMessage('error', 'Error', 'An error occurred while deleting the flag. Please try again.');
        }
      },
      () => {
        setShowConfirmModal(false);
      },
      'Delete Flag',
      'Cancel'
    );
  };

  // Handle delete endorsement
  const handleDeleteEndorsement = async (sellerId: string) => {
    showConfirmation(
      'Delete Endorsement',
      'Are you sure you want to delete this endorsement? This action cannot be undone.',
      async () => {
        setShowConfirmModal(false);

        try {
          const response = await apiService.deleteEndorsement(sellerId);

          if (response.success && response.data) {
            const { newPulseScore, newConfidenceLevel, totalEndorsements, netFeedbackScore } = response.data;
            showMessage(
              'success',
              'Endorsement Deleted',
              response.message || 'Endorsement has been deleted successfully.',
              `New Pulse Score: ${newPulseScore}/100\nConfidence Level: ${newConfidenceLevel}\nTotal Endorsements: ${totalEndorsements}\nNet Feedback Score: ${netFeedbackScore > 0 ? '+' : ''}${netFeedbackScore}`
            );
            // Refresh feedback data if on feedbacks tab
            if (activeActivitySubTab === 'feedbacks') {
              fetchFeedbackData();
            }
            // Refresh interactions data if on interactions tab
            if (activeActivitySubTab === 'interactions') {
              fetchInteractionsData();
            }
          } else {
            showMessage('error', 'Delete Failed', response.error || 'Failed to delete endorsement. Please try again.');
          }
        } catch (err: any) {
          console.error('Delete endorsement error:', err);
          showMessage('error', 'Error', 'An error occurred while deleting the endorsement. Please try again.');
        }
      },
      () => {
        setShowConfirmModal(false);
      },
      'Delete Endorsement',
      'Cancel'
    );
  };

  const handleBecomeSeller = async () => {
    if (!selectedPlatform || !sellerProfileUrl.trim()) {
      showMessage('error', 'Validation Error', 'Please select a platform and enter your profile URL');
      return;
    }

    showConfirmation(
      'Become A Seller',
      `Are you sure you want to submit your seller registration for ${selectedPlatform}? Your profile will be reviewed before approval.`,
      async () => {
        setShowConfirmModal(false);
        setIsSubmittingSeller(true);
        setError('');

        try {
          const response = await apiService.becomeSeller(selectedPlatform, sellerProfileUrl.trim());

          if (response.success) {
            showMessage(
              'success',
              'Registration Submitted',
              response.message || 'Seller registration submitted! We will review your profile.',
              response.data?.seller ? `Your seller profile has been created and is pending review.` : undefined
            );
            setShowBecomeSeller(false);
            setSelectedPlatform('');
            setSellerProfileUrl('');
          } else {
            showMessage(
              'error',
              'Registration Failed',
              response.error || 'Failed to submit seller registration. Please try again.'
            );
          }
        } catch (err: any) {
          console.error('Become seller error:', err);
          showMessage('error', 'Error', 'An error occurred. Please try again.');
        } finally {
          setIsSubmittingSeller(false);
        }
      },
      () => {
        setShowConfirmModal(false);
      },
      'Submit Registration',
      'Cancel'
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="dashboard-container metamask-style">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Seller view (placeholder)
  if (isSeller) {
    return (
      <div className="dashboard-container metamask-style">
        <div className="header-modern">
          <Logo size="small" showText={false} />
          <div className="header-right">
            <div className="user-menu">
              <button className="user-button" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar">
                  <span>{currentUser?.name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                </div>
                <span className="user-name">{currentUser?.name || user?.name || 'User'}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <p className="user-name-dropdown">{currentUser?.name || user?.name || 'User'}</p>
                    <p className="user-email">{currentUser?.email || user?.email || 'No email'}</p>
                  </div>
                  <button className="settings-btn" onClick={() => {
                    setShowSettings(true);
                    setShowUserMenu(false);
                  }}>Settings</button>
                  <button className="logout-btn" onClick={() => {
                    showConfirmation(
                      'Sign Out',
                      'Are you sure you want to sign out? You will need to log in again to access your account.',
                      () => {
                        setShowConfirmModal(false);
                        onLogout();
                      },
                      () => {
                        setShowConfirmModal(false);
                      },
                      'Sign Out',
                      'Cancel'
                    );
                  }}>Sign Out</button>
                  <button className="delete-account-btn" onClick={handleDeleteAccount}>Delete Account</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="dashboard-content">
          {/* Welcome Section */}
          <div className="welcome-section">
            <h2>Welcome back, {currentUser?.name || user?.name || 'Seller'}! 👋</h2>
            <p>Manage your seller profile and track your performance</p>
          </div>

          {/* Loading State */}
          {isLoadingSellerProfile ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading your seller profile...</p>
            </div>
          ) : sellerProfile ? (
            <>
              {/* Seller Stats Grid */}
              <div className="stats-grid-modern">
                <div className="stat-card-modern">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Pulse Score</div>
                    <div className={`stat-value ${getScoreClass(sellerProfile.pulseScore)}`}>
                      {sellerProfile.pulseScore}
                    </div>
                    <div className="stat-subtext">{sellerProfile.confidenceLevel}</div>
                  </div>
                </div>
                <div className="stat-card-modern">
                  <div className="stat-icon">🚩</div>
                  <div className="stat-content">
                    <div className="stat-label">Flags</div>
                    <div className="stat-value">{sellerProfile.flags?.length || 0}</div>
                    <div className="stat-subtext">Negative</div>
                  </div>
                </div>
                <div className="stat-card-modern">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-label">Endorsements</div>
                    <div className="stat-value">{sellerProfile.endorsements?.length || 0}</div>
                    <div className="stat-subtext">Positive</div>
                  </div>
                </div>
                <div className="stat-card-modern">
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <div className="stat-label">Listings</div>
                    <div className="stat-value">{sellerProfile.marketplaceData?.totalListings || 0}</div>
                    <div className="stat-subtext">Total</div>
                  </div>
                </div>
              </div>

              {/* Seller Tabs */}
              <div className="dashboard-tabs">
                <button
                  className={`tab-btn ${sellerActiveTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setSellerActiveTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={`tab-btn ${sellerActiveTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setSellerActiveTab('profile')}
                >
                  Profile
                </button>
                <button
                  className={`tab-btn ${sellerActiveTab === 'feedback' ? 'active' : ''}`}
                  onClick={() => setSellerActiveTab('feedback')}
                >
                  Feedback
                </button>
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {sellerActiveTab === 'overview' && (
                  <div className="seller-overview-content">
                    {/* Pulse Score Card */}
                    <div className="seller-pulse-card">
                      <div className="pulse-card-header">
                        <h3>Your Pulse Score</h3>
                        <div className={`pulse-badge ${getScoreClass(sellerProfile.pulseScore)}`}>
                          {sellerProfile.pulseScore}
                        </div>
                      </div>
                      <div className="pulse-card-body">
                        <div className="confidence-level">
                          <span className="confidence-label">Confidence Level:</span>
                          <span className={`confidence-value ${sellerProfile.confidenceLevel}`}>
                            {sellerProfile.confidenceLevel.toUpperCase()}
                          </span>
                        </div>
                        {sellerProfile.lastScored && (
                          <div className="last-scored">
                            Last scored: {formatTimestamp(sellerProfile.lastScored)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Marketplace Stats */}
                    {sellerProfile.marketplaceData && (
                      <div className="marketplace-stats-card">
                        <h3>Marketplace Statistics</h3>
                        <div className="marketplace-stats-grid">
                          <div className="marketplace-stat-item">
                            <span className="marketplace-stat-label">Total Reviews</span>
                            <span className="marketplace-stat-value">{sellerProfile.marketplaceData.totalReviews || 0}</span>
                          </div>
                          <div className="marketplace-stat-item">
                            <span className="marketplace-stat-label">Average Rating</span>
                            <span className="marketplace-stat-value">{sellerProfile.marketplaceData.avgRating?.toFixed(1) || '0.0'}</span>
                          </div>
                          <div className="marketplace-stat-item">
                            <span className="marketplace-stat-label">Response Rate</span>
                            <span className="marketplace-stat-value">{sellerProfile.marketplaceData.responseRate || 0}%</span>
                          </div>
                          <div className="marketplace-stat-item">
                            <span className="marketplace-stat-label">Followers</span>
                            <span className="marketplace-stat-value">{sellerProfile.marketplaceData.followers || 0}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {sellerScoringResult?.recommendations && sellerScoringResult.recommendations.length > 0 && (
                      <div className="recommendations-card">
                        <h3>Recommendations</h3>
                        <div className="recommendations-list">
                          {sellerScoringResult.recommendations.map((rec: any, idx: number) => (
                            <div key={idx} className={`recommendation-item ${rec.type}`}>
                              <div className="recommendation-header">
                                <span className="recommendation-type">{rec.type}</span>
                              </div>
                              <div className="recommendation-message">{rec.message}</div>
                              {rec.action && (
                                <div className="recommendation-action">
                                  <span className="recommendation-action-label">Action:</span>
                                  <span className="recommendation-action-text">{rec.action}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sellerActiveTab === 'profile' && (
                  <div className="seller-profile-content">
                    {/* Profile Info */}
                    <div className="seller-profile-section">
                      <h3>Profile Information</h3>
                      <div className="seller-profile-info">
                        <div className="seller-profile-avatar">
                          {sellerProfile.profileData?.profilePicture && cleanProfilePicture(sellerProfile.profileData.profilePicture) ? (
                            <img
                              src={sellerProfile.profileData.profilePicture}
                              alt={cleanSellerName(sellerProfile.profileData.name)}
                              onError={(e) => handleImageError(e, cleanSellerName(sellerProfile.profileData?.name || 'Seller'))}
                            />
                          ) : (
                            <div
                              className="avatar-placeholder"
                              style={{ backgroundColor: getAvatarColor(cleanSellerName(sellerProfile.profileData?.name || 'Seller')) }}
                            >
                              {getInitials(cleanSellerName(sellerProfile.profileData?.name || 'Seller'))}
                            </div>
                          )}
                        </div>
                        <div className="seller-profile-details">
                          <div className="seller-profile-name">{cleanSellerName(sellerProfile.profileData?.name || 'N/A')}</div>
                          <div className="seller-profile-platform">
                            {getPlatformIcon(sellerProfile.platform)} {sellerProfile.platform}
                          </div>
                          {sellerProfile.profileData?.location && (
                            <div className="seller-profile-location">📍 {sellerProfile.profileData.location}</div>
                          )}
                          {sellerProfile.profileUrl && (
                            <div className="seller-profile-url">
                              <a href={sellerProfile.profileUrl} target="_blank" rel="noopener noreferrer">
                                View Profile →
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      {sellerProfile.profileData?.bio && (
                        <div className="seller-profile-bio">
                          <h4>Bio</h4>
                          <p>{sellerProfile.profileData.bio}</p>
                        </div>
                      )}
                    </div>

                    {/* Account Details */}
                    <div className="seller-profile-section">
                      <h3>Account Details</h3>
                      <div className="seller-account-details">
                        <div className="account-detail-item">
                          <span className="account-detail-label">Verification Status</span>
                          <span className={`account-detail-value ${sellerProfile.verificationStatus === 'verified' ? 'verified' : 'unverified'}`}>
                            {sellerProfile.verificationStatus === 'verified' ? '✓ Verified' : '✗ Unverified'}
                          </span>
                        </div>
                        <div className="account-detail-item">
                          <span className="account-detail-label">Account Status</span>
                          <span className={`account-detail-value ${sellerProfile.isActive ? 'active' : 'inactive'}`}>
                            {sellerProfile.isActive ? '✓ Active' : '✗ Inactive'}
                          </span>
                        </div>
                        <div className="account-detail-item">
                          <span className="account-detail-label">Claimed</span>
                          <span className={`account-detail-value ${sellerProfile.isClaimed ? 'claimed' : 'unclaimed'}`}>
                            {sellerProfile.isClaimed ? '✓ Claimed' : '✗ Unclaimed'}
                          </span>
                        </div>
                        {sellerProfile.firstSeen && (
                          <div className="account-detail-item">
                            <span className="account-detail-label">First Seen</span>
                            <span className="account-detail-value">{formatTimestamp(sellerProfile.firstSeen)}</span>
                          </div>
                        )}
                        {sellerProfile.lastSeen && (
                          <div className="account-detail-item">
                            <span className="account-detail-label">Last Seen</span>
                            <span className="account-detail-value">{formatTimestamp(sellerProfile.lastSeen)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Categories */}
                    {sellerProfile.marketplaceData?.categories && sellerProfile.marketplaceData.categories.length > 0 && (
                      <div className="seller-profile-section">
                        <h3>Categories</h3>
                        <div className="categories-list">
                          {sellerProfile.marketplaceData.categories.map((cat: any, idx: number) => (
                            <span key={idx} className="category-badge">
                              {cleanSellerName(cat.name)} ({cat.count || 0})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sellerActiveTab === 'feedback' && (
                  <div className="seller-feedback-content">
                    {/* Flags */}
                    <div className="seller-feedback-section">
                      <h3>Flags ({sellerProfile.flags?.length || 0})</h3>
                      {sellerProfile.flags && sellerProfile.flags.length > 0 ? (
                        <div className="feedback-list">
                          {sellerProfile.flags.map((flag: any, idx: number) => (
                            <div key={idx} className="feedback-card flag-item">
                              <div className="feedback-item-header">
                                <div className="feedback-type">
                                  <span className="feedback-icon">🚩</span>
                                  <span className="feedback-type-label">Flag</span>
                                </div>
                              </div>
                              <div className="feedback-card-body">
                                <div className="feedback-reason">{flag.reason || 'No reason provided'}</div>
                                <div className="feedback-meta">
                                  <span className="feedback-time">{formatTimestamp(flag.timestamp || flag.createdAt)}</span>
                                  {flag.isVerified && (
                                    <span className="feedback-verified">✓ Verified</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state-modern">
                          <div className="empty-icon">✅</div>
                          <p>No flags on your profile</p>
                        </div>
                      )}
                    </div>

                    {/* Endorsements */}
                    <div className="seller-feedback-section">
                      <h3>Endorsements ({sellerProfile.endorsements?.length || 0})</h3>
                      {sellerProfile.endorsements && sellerProfile.endorsements.length > 0 ? (
                        <div className="feedback-list">
                          {sellerProfile.endorsements.map((endorsement: any, idx: number) => (
                            <div key={idx} className="feedback-card endorsement-item">
                              <div className="feedback-item-header">
                                <div className="feedback-type">
                                  <span className="feedback-icon">✅</span>
                                  <span className="feedback-type-label">Endorsement</span>
                                </div>
                              </div>
                              <div className="feedback-card-body">
                                <div className="feedback-reason">{endorsement.reason || 'No reason provided'}</div>
                                <div className="feedback-meta">
                                  <span className="feedback-time">{formatTimestamp(endorsement.timestamp || endorsement.createdAt)}</span>
                                  {endorsement.isVerified && (
                                    <span className="feedback-verified">✓ Verified</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state-modern">
                          <div className="empty-icon">📝</div>
                          <p>No endorsements yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state-modern">
              <div className="empty-icon">⚠️</div>
              <p>No seller profile found. Please contact support if you believe this is an error.</p>
            </div>
          )}
        </div>

        {/* Global Message Modal */}
        {showMessageModal && messageModalData && (
          <div className="modal-overlay" onClick={() => {
            setShowMessageModal(false);
            setMessageModalData(null);
          }}>
            <div className="modal-content message-modal" onClick={(e) => e.stopPropagation()}>
              <div className={`message-modal-header ${messageModalData.type}`}>
                <div className="message-modal-icon">
                  {messageModalData.type === 'success' ? '✅' : '❌'}
                </div>
                <h3 className="message-modal-title">{messageModalData.title}</h3>
                <button
                  className="modal-close message-modal-close"
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageModalData(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="message-modal-body">
                <p className="message-modal-text">{messageModalData.message}</p>
                {messageModalData.details && (
                  <div className="message-modal-details">
                    <strong>Details:</strong>
                    <p>{messageModalData.details}</p>
                  </div>
                )}
              </div>
              <div className="message-modal-footer">
                <button
                  className="verible-btn primary-btn"
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageModalData(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Confirmation Modal */}
        {showConfirmModal && confirmModalData && (
          <div className="modal-overlay" onClick={() => {
            setShowConfirmModal(false);
            if (confirmModalData.onCancel) {
              confirmModalData.onCancel();
            }
          }}>
            <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-modal-header">
                <h3 className="confirm-modal-title">{confirmModalData.title}</h3>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowConfirmModal(false);
                    if (confirmModalData.onCancel) {
                      confirmModalData.onCancel();
                    }
                  }}
                >
                  ×
                </button>
              </div>
              <div className="confirm-modal-body">
                <p className="confirm-modal-message">{confirmModalData.message}</p>
              </div>
              <div className="confirm-modal-footer">
                <button
                  className="verible-btn secondary-btn"
                  onClick={() => {
                    setShowConfirmModal(false);
                    if (confirmModalData.onCancel) {
                      confirmModalData.onCancel();
                    }
                  }}
                >
                  {confirmModalData.cancelText || 'Cancel'}
                </button>
                <button
                  className="verible-btn primary-btn"
                  onClick={() => {
                    setShowConfirmModal(false);
                    if (confirmModalData.onConfirm) {
                      confirmModalData.onConfirm();
                    }
                  }}
                >
                  {confirmModalData.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Settings</h3>
                <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
              </div>
              <div className="modal-body">
                {isLoadingSettings ? (
                  <div className="loading-container" style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading user details...</p>
                  </div>
                ) : settingsUserData ? (
                  <>
                    <div className="settings-section">
                      <h4 className="settings-section-title">User Details</h4>
                      <div className="settings-info-grid">
                        <div className="settings-info-item">
                          <span className="settings-info-label">User ID</span>
                          <span className="settings-info-value">{settingsUserData._id}</span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Email</span>
                          <span className="settings-info-value">{settingsUserData.email}</span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Phone</span>
                          <span className="settings-info-value">{settingsUserData.phone || 'Not provided'}</span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Role</span>
                          <span className="settings-info-value">{settingsUserData.role || 'user'}</span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Verified</span>
                          <span className={`settings-info-value ${settingsUserData.verified ? 'verified' : 'unverified'}`}>
                            {settingsUserData.verified ? '✓ Yes' : '✗ No'}
                          </span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Verification Method</span>
                          <span className="settings-info-value">{settingsUserData.verificationMethod || 'N/A'}</span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Status</span>
                          <span className={`settings-info-value ${settingsUserData.isActive ? 'active' : 'inactive'}`}>
                            {settingsUserData.isActive ? '✓ Active' : '✗ Inactive'}
                          </span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Created At</span>
                          <span className="settings-info-value">
                            {settingsUserData.createdAt
                              ? (() => {
                                const date = new Date(settingsUserData.createdAt);
                                return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
                              })()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="settings-info-item">
                          <span className="settings-info-label">Last Updated</span>
                          <span className="settings-info-value">
                            {settingsUserData.updatedAt
                              ? (() => {
                                const date = new Date(settingsUserData.updatedAt);
                                return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
                              })()
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="settings-section">
                      <h4 className="settings-section-title">Edit Profile</h4>
                      <div className="form-group">
                        <label htmlFor="settings-name" className="form-label">
                          Name
                        </label>
                        <input
                          id="settings-name"
                          type="text"
                          className="form-input"
                          placeholder="Enter your name"
                          value={settingsFormData.name}
                          onChange={(e) => setSettingsFormData({ ...settingsFormData, name: e.target.value })}
                          disabled={isSavingSettings}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state-modern">
                    <div className="empty-icon">⚠️</div>
                    <p>Failed to load user details</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="verible-btn secondary-btn"
                  onClick={() => {
                    setShowSettings(false);
                    setSettingsUserData(null);
                    setSettingsFormData({ name: '' });
                  }}
                  disabled={isSavingSettings}
                >
                  Cancel
                </button>
                <button
                  className="verible-btn primary-btn"
                  onClick={async () => {
                    if (!settingsFormData.name.trim()) {
                      showMessage('error', 'Validation Error', 'Please enter a name');
                      return;
                    }

                    setIsSavingSettings(true);
                    try {
                      const response = await apiService.updateProfile({ name: settingsFormData.name.trim() });

                      if (response.success && response.data) {
                        // Update current user state
                        setCurrentUser(response.data);
                        // Update stored auth data
                        await authService.updateUserData(response.data);
                        // Refresh settings data
                        setSettingsUserData(response.data);
                        setSettingsFormData({ name: response.data.name });
                        showMessage('success', 'Profile Updated', 'Your profile has been updated successfully.');
                      } else {
                        showMessage('error', 'Update Failed', response.error || 'Failed to update profile. Please try again.');
                      }
                    } catch (err: any) {
                      console.error('Error updating profile:', err);
                      showMessage('error', 'Error', 'An error occurred while updating your profile. Please try again.');
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                  disabled={isSavingSettings || !settingsFormData.name.trim() || settingsFormData.name === settingsUserData?.name}
                >
                  {isSavingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Buyer Dashboard - Metamask Style
  return (
    <div className="dashboard-container metamask-style">
      {/* Modern Header */}
      <div className="header-modern">
        <div className="header-left">
          <Logo size="small" showText={false} />
          <div className="account-info">
            <div className="account-name">
              {currentUser?.name || user?.name || 'Account 1'}
              <span className="account-indicator">👤 Buyer</span>
            </div>
            <div className="account-subtitle">
              {stats.totalAnalyses > 0 ? `${stats.totalAnalyses} analyses` : 'No analyses yet'}
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="status-indicator">
            <div className="status-dot active"></div>
            <span>Active</span>
          </div>

          <div className="user-menu">
            <button className="user-button" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="user-avatar">
                {currentUser?.avatar || user?.avatar ? (
                  <img src={currentUser?.avatar || user?.avatar} alt={currentUser?.name || user?.name} />
                ) : (
                  <span>{(currentUser?.name || user?.name)?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <span className="dropdown-arrow">▼</span>
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-info">
                  <p className="user-name-dropdown">{currentUser?.name || user?.name || 'User'}</p>
                  <p className="user-email">{currentUser?.email || user?.email || 'No email'}</p>
                </div>
                <button className="settings-btn" onClick={() => {
                  setShowSettings(true);
                  setShowUserMenu(false);
                }}>Settings</button>
                <button className="logout-btn" onClick={() => {
                  showConfirmation(
                    'Sign Out',
                    'Are you sure you want to sign out? You will need to log in again to access your account.',
                    () => {
                      setShowConfirmModal(false);
                      onLogout();
                    },
                    () => {
                      setShowConfirmModal(false);
                    },
                    'Sign Out',
                    'Cancel'
                  );
                }}>Sign Out</button>
                <button className="delete-account-btn" onClick={handleDeleteAccount}>Delete Account</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Main Dashboard Content */}
      <div className="dashboard-content-modern">
        {/* Trust Score Display (Like Balance) */}
        <div className="trust-score-display">
          <div className="trust-score-label">Average Trust Score</div>
          <div className="trust-score-value">
            {stats.averageScore > 0 ? stats.averageScore : '--'}
            <span className="trust-score-max">/100</span>
          </div>
          {stats.totalAnalyses > 0 && (
            <div className="trust-score-change">
              {stats.trustedCount > stats.avoidCount ? '+' : ''}
              {stats.trustedCount - stats.avoidCount} trusted sellers
            </div>
          )}
        </div>

        {/* Seller Search Input */}
        <div className="seller-search-container">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="seller-search-input"
              placeholder="Paste seller profile URL to analyze..."
              value={sellerSearchUrl}
              onChange={(e) => setSellerSearchUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSellerSearch();
                }
              }}
              disabled={isSearching}
            />
            <button
              className="search-btn"
              onClick={() => handleSellerSearch()}
              disabled={isSearching || !sellerSearchUrl.trim()}
            >
              {isSearching ? '⏳' : '🔍'}
            </button>
          </div>
        </div>

        {/* Action Buttons (Like Buy, Swap, Send, Receive) */}
        <div className="action-buttons">
          <button
            className={`action-btn ${activeAction === 'analyze' ? 'active' : ''}`}
            onClick={handleAnalyze}
          >
            <div className="action-icon">🔍</div>
            <span>Analyze</span>
          </button>
          <button
            className={`action-btn ${activeAction === 'view-sellers' ? 'active' : ''}`}
            onClick={handleViewSellers}
          >
            <div className="action-icon">📊</div>
            <span>View Sellers</span>
          </button>
          <button
            className={`action-btn ${activeAction === 'reports' ? 'active' : ''}`}
            onClick={handleReports}
          >
            <div className="action-icon">📋</div>
            <span>Reports</span>
          </button>
          <button className="action-btn" onClick={() => setShowBecomeSeller(true)}>
            <div className="action-icon">🏪</div>
            <span>Become A Seller</span>
          </button>
        </div>

        {/* Action Content - Displayed above Navigation Tabs */}
        {activeAction === 'analyze' && (
          <div className="action-content">
            <div className="action-content-header">
              <h3>Analyze Seller</h3>
              <button className="close-action-btn" onClick={() => {
                setActiveAction(null);
                setAnalyzeSearchType('url');
                setAnalyzeUrl('');
                setAnalyzeName('');
                setAnalyzePlatform('');
                setAnalyzeLocation('');
              }}>×</button>
            </div>
            <div className="action-content-body">
              {/* Search Type Selector */}
              <div className="analyze-search-tabs">
                <button
                  className={`analyze-search-tab ${analyzeSearchType === 'url' ? 'active' : ''}`}
                  onClick={() => {
                    setAnalyzeSearchType('url');
                    setAnalyzeName('');
                    setAnalyzePlatform('');
                    setAnalyzeLocation('');
                  }}
                >
                  <span className="tab-icon">🔗</span>
                  <span>Search by URL</span>
                </button>
                <button
                  className={`analyze-search-tab ${analyzeSearchType === 'name-platform' ? 'active' : ''}`}
                  onClick={() => {
                    setAnalyzeSearchType('name-platform');
                    setAnalyzeUrl('');
                    setAnalyzeLocation('');
                  }}
                >
                  <span className="tab-icon">👤</span>
                  <span>Name & Platform</span>
                </button>
                <button
                  className={`analyze-search-tab ${analyzeSearchType === 'name-platform-location' ? 'active' : ''}`}
                  onClick={() => {
                    setAnalyzeSearchType('name-platform-location');
                    setAnalyzeUrl('');
                  }}
                >
                  <span className="tab-icon">📍</span>
                  <span>Name, Platform & Location</span>
                </button>
              </div>

              {/* Search Form */}
              <div className="analyze-search-form">
                {analyzeSearchType === 'url' && (
                  <div className="search-form-group">
                    <label htmlFor="analyze-url" className="form-label">
                      <span className="label-icon">🔗</span>
                      Profile URL
                    </label>
                    <input
                      id="analyze-url"
                      type="text"
                      className="form-input"
                      placeholder="Paste seller profile URL here (e.g., https://jiji.ng/shop/seller-name)"
                      value={analyzeUrl}
                      onChange={(e) => setAnalyzeUrl(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && analyzeUrl.trim()) {
                          handleAnalyzeSearch();
                        }
                      }}
                      disabled={isAnalyzing}
                    />
                    <small className="form-hint">Enter the full URL of the seller's profile page</small>
                  </div>
                )}

                {analyzeSearchType === 'name-platform' && (
                  <>
                    <div className="search-form-group">
                      <label htmlFor="analyze-name" className="form-label">
                        <span className="label-icon">👤</span>
                        Seller Name
                      </label>
                      <input
                        id="analyze-name"
                        type="text"
                        className="form-input"
                        placeholder="Enter seller name"
                        value={analyzeName}
                        onChange={(e) => setAnalyzeName(e.target.value)}
                        disabled={isAnalyzing}
                      />
                    </div>
                    <div className="search-form-group">
                      <label htmlFor="analyze-platform-name" className="form-label">
                        <span className="label-icon">🏪</span>
                        Platform
                      </label>
                      <select
                        id="analyze-platform-name"
                        className="form-input"
                        value={analyzePlatform}
                        onChange={(e) => setAnalyzePlatform(e.target.value)}
                        disabled={isAnalyzing}
                      >
                        <option value="">Select platform...</option>
                        <option value="facebook">Facebook Marketplace</option>
                        <option value="jiji">Jiji.ng</option>
                        <option value="craigslist">Craigslist</option>
                        <option value="offerup">OfferUp</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </>
                )}

                {analyzeSearchType === 'name-platform-location' && (
                  <>
                    <div className="search-form-group">
                      <label htmlFor="analyze-name-location" className="form-label">
                        <span className="label-icon">👤</span>
                        Seller Name
                      </label>
                      <input
                        id="analyze-name-location"
                        type="text"
                        className="form-input"
                        placeholder="Enter seller name"
                        value={analyzeName}
                        onChange={(e) => setAnalyzeName(e.target.value)}
                        disabled={isAnalyzing}
                      />
                    </div>
                    <div className="search-form-group">
                      <label htmlFor="analyze-platform-location" className="form-label">
                        <span className="label-icon">🏪</span>
                        Platform
                      </label>
                      <select
                        id="analyze-platform-location"
                        className="form-input"
                        value={analyzePlatform}
                        onChange={(e) => setAnalyzePlatform(e.target.value)}
                        disabled={isAnalyzing}
                      >
                        <option value="">Select platform...</option>
                        <option value="facebook">Facebook Marketplace</option>
                        <option value="jiji">Jiji.ng</option>
                        <option value="craigslist">Craigslist</option>
                        <option value="offerup">OfferUp</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="search-form-group">
                      <label htmlFor="analyze-location" className="form-label">
                        <span className="label-icon">📍</span>
                        Location
                      </label>
                      <input
                        id="analyze-location"
                        type="text"
                        className="form-input"
                        placeholder="Enter location (e.g., Lagos, Nigeria)"
                        value={analyzeLocation}
                        onChange={(e) => setAnalyzeLocation(e.target.value)}
                        disabled={isAnalyzing}
                      />
                    </div>
                  </>
                )}

                {/* Search Button */}
                <button
                  className="analyze-search-btn verible-btn primary-btn"
                  onClick={handleAnalyzeSearch}
                  disabled={isAnalyzing ||
                    (analyzeSearchType === 'url' && !analyzeUrl.trim()) ||
                    (analyzeSearchType === 'name-platform' && (!analyzeName.trim() || !analyzePlatform)) ||
                    (analyzeSearchType === 'name-platform-location' && (!analyzeName.trim() || !analyzePlatform || !analyzeLocation.trim()))
                  }
                >
                  {isAnalyzing ? (
                    <>
                      <span className="loading-spinner-small"></span>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Analyze Seller</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeAction === 'view-sellers' && (
          <div className="action-content">
            <div className="action-content-header">
              <h3>View Sellers</h3>
              <button className="close-action-btn" onClick={() => {
                setActiveAction(null);
                setShowSellerView(false);
              }}>×</button>
            </div>
            <div className="action-content-body">
              <div className="seller-view-tabs">
                <button
                  className={`seller-tab ${sellerViewTab === 'top' ? 'active' : ''}`}
                  onClick={() => {
                    setSellerViewTab('top');
                    loadSellers('top');
                  }}
                >
                  Top Sellers
                </button>
                <button
                  className={`seller-tab ${sellerViewTab === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setSellerViewTab('all');
                    loadSellers('all');
                  }}
                >
                  All Sellers
                </button>
              </div>

              {isLoadingSellers ? (
                <div className="empty-state-modern">
                  <div className="loading-spinner"></div>
                  <p>Loading sellers...</p>
                </div>
              ) : sellerViewTab === 'top' ? (
                topSellers.length > 0 ? (
                  <div className="sellers-grid">
                    {topSellers.map((seller) => (
                      <div key={seller._id} className="seller-card">
                        <div className="seller-card-header">
                          <div className="seller-avatar-card">
                            {(() => {
                              const cleanedPic = cleanProfilePicture(seller.profileData.profilePicture);
                              return cleanedPic ? (
                                <img
                                  src={cleanedPic}
                                  alt={cleanSellerName(seller.profileData.name)}
                                  className="seller-avatar-img"
                                  onError={(e) => handleImageError(e, seller.profileData.name)}
                                />
                              ) : (
                                <div
                                  className="seller-avatar-placeholder"
                                  style={{ backgroundColor: getAvatarColor(seller.profileData.name) }}
                                >
                                  {getInitials(seller.profileData.name)}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="seller-card-info">
                            <h4 className="seller-card-name">{cleanSellerName(seller.profileData.name)}</h4>
                            <div className="seller-card-platform">
                              {getPlatformIcon(seller.platform)} {seller.platform}
                            </div>
                          </div>
                        </div>

                        <div className="seller-card-body">
                          <div className="pulse-score-display">
                            <div className="pulse-score-value">
                              {seller.pulseScore}
                              <span className="pulse-score-max">/100</span>
                            </div>
                            <div className={`confidence-badge ${getConfidenceClass(seller.confidenceLevel)}`}>
                              {seller.confidenceLevel}
                            </div>
                          </div>

                          <div className="seller-stats-mini">
                            <div className="stat-mini">
                              <span className="stat-mini-label">Listings</span>
                              <span className="stat-mini-value">{seller.marketplaceData.totalListings}</span>
                            </div>
                            <div className="stat-mini">
                              <span className="stat-mini-label">Reviews</span>
                              <span className="stat-mini-value">{seller.marketplaceData.totalReviews}</span>
                            </div>
                            {seller.isClaimed && (
                              <div className="claimed-badge">✓ Claimed</div>
                            )}
                          </div>
                        </div>

                        <div className="seller-card-actions">
                          <button
                            className="action-button view-btn"
                            onClick={() => handleViewSeller(seller)}
                          >
                            View
                          </button>
                          <button
                            className="action-button flag-btn"
                            onClick={() => handleFlagSeller(seller)}
                          >
                            Flag
                          </button>
                          <button
                            className="action-button endorse-btn"
                            onClick={() => handleEndorseSeller(seller)}
                          >
                            Endorse
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-modern">
                    <div className="empty-icon">⭐</div>
                    <p>No top sellers found</p>
                  </div>
                )
              ) : (
                allSellers.length > 0 ? (
                  <div className="sellers-grid">
                    {allSellers.map((seller) => (
                      <div key={seller._id} className="seller-card">
                        <div className="seller-card-header">
                          <div className="seller-avatar-card">
                            {(() => {
                              const cleanedPic = cleanProfilePicture(seller.profileData.profilePicture);
                              return cleanedPic ? (
                                <img
                                  src={cleanedPic}
                                  alt={cleanSellerName(seller.profileData.name)}
                                  className="seller-avatar-img"
                                  onError={(e) => handleImageError(e, seller.profileData.name)}
                                />
                              ) : (
                                <div
                                  className="seller-avatar-placeholder"
                                  style={{ backgroundColor: getAvatarColor(seller.profileData.name) }}
                                >
                                  {getInitials(seller.profileData.name)}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="seller-card-info">
                            <h4 className="seller-card-name">{cleanSellerName(seller.profileData.name)}</h4>
                            <div className="seller-card-platform">
                              {getPlatformIcon(seller.platform)} {seller.platform}
                            </div>
                          </div>
                        </div>

                        <div className="seller-card-body">
                          <div className="pulse-score-display">
                            <div className="pulse-score-value">
                              {seller.pulseScore}
                              <span className="pulse-score-max">/100</span>
                            </div>
                            <div className={`confidence-badge ${getConfidenceClass(seller.confidenceLevel)}`}>
                              {seller.confidenceLevel}
                            </div>
                          </div>

                          <div className="seller-stats-mini">
                            <div className="stat-mini">
                              <span className="stat-mini-label">Listings</span>
                              <span className="stat-mini-value">{seller.marketplaceData.totalListings}</span>
                            </div>
                            <div className="stat-mini">
                              <span className="stat-mini-label">Reviews</span>
                              <span className="stat-mini-value">{seller.marketplaceData.totalReviews}</span>
                            </div>
                            {seller.isClaimed && (
                              <div className="claimed-badge">✓ Claimed</div>
                            )}
                          </div>
                        </div>

                        <div className="seller-card-actions">
                          <button
                            className="action-button view-btn"
                            onClick={() => handleViewSeller(seller)}
                          >
                            View
                          </button>
                          <button
                            className="action-button flag-btn"
                            onClick={() => handleFlagSeller(seller)}
                          >
                            Flag
                          </button>
                          <button
                            className="action-button endorse-btn"
                            onClick={() => handleEndorseSeller(seller)}
                          >
                            Endorse
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-modern">
                    <div className="empty-icon">📋</div>
                    <p>No sellers found</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {activeAction === 'reports' && (
          <div className="action-content">
            <div className="action-content-header">
              <h3>Reports</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <select
                  value={extractionsTimeRange}
                  onChange={(e) => setExtractionsTimeRange(e.target.value as '7d' | '30d')}
                  className="time-range-select"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
                <button className="close-action-btn" onClick={() => setActiveAction(null)}>×</button>
              </div>
            </div>
            <div className="action-content-body">
              {isLoadingExtractions ? (
                <div className="empty-state-modern">
                  <div className="loading-spinner"></div>
                  <p>Loading reports...</p>
                </div>
              ) : extractionsData && extractionsData.sellers.length > 0 ? (
                <>
                  {extractionsData.metrics && (
                    <div className="reports-metrics" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '12px',
                      marginBottom: '20px',
                      padding: '0 10px'
                    }}>
                      <div className="metric-card" style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                          {extractionsData.metrics.totalCount}
                        </div>
                        {extractionsData.metrics.totalCountChange && (
                          <div style={{
                            fontSize: '10px',
                            color: extractionsData.metrics.totalCountChangeValue >= 0 ? '#10b981' : '#ef4444',
                            marginTop: '4px'
                          }}>
                            {extractionsData.metrics.totalCountChange}
                          </div>
                        )}
                      </div>
                      <div className="metric-card" style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Avg Score</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                          {extractionsData.metrics.averagePulseScore}
                        </div>
                        {extractionsData.metrics.averagePulseScoreChange && (
                          <div style={{
                            fontSize: '10px',
                            color: extractionsData.metrics.averagePulseScoreChangeValue >= 0 ? '#10b981' : '#ef4444',
                            marginTop: '4px'
                          }}>
                            {extractionsData.metrics.averagePulseScoreChange}
                          </div>
                        )}
                      </div>
                      <div className="metric-card" style={{
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>High Risk</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>
                          {extractionsData.metrics.highRiskCount}
                        </div>
                        {extractionsData.metrics.highRiskCountChange && (
                          <div style={{
                            fontSize: '10px',
                            color: extractionsData.metrics.highRiskCountChangeValue >= 0 ? '#ef4444' : '#10b981',
                            marginTop: '4px'
                          }}>
                            {extractionsData.metrics.highRiskCountChange}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="reports-list">
                    {extractionsData.sellers.map((seller) => (
                      <div key={seller.id} className="report-item" onClick={() => {
                        const sellerObj: Seller = {
                          _id: seller.id,
                          sellerId: seller.sellerId,
                          platform: seller.platform,
                          profileUrl: seller.profileUrl,
                          pulseScore: seller.pulseScore,
                          confidenceLevel: seller.confidenceLevel.toLowerCase() as 'high' | 'medium' | 'low',
                          verificationStatus: seller.verificationStatus,
                          isActive: true,
                          isClaimed: false,
                          profileData: seller.profileData,
                          marketplaceData: {
                            accountAge: 0,
                            totalListings: 0,
                            avgRating: 0,
                            totalReviews: 0,
                            responseRate: 0,
                            verificationStatus: 'unverified',
                            followers: 0,
                            categories: []
                          }
                        };
                        handleViewSeller(sellerObj);
                      }}>
                        <div className="report-icon">{getPlatformIcon(seller.platform)}</div>
                        <div className="report-details">
                          <div className="report-main">
                            <span className="report-seller">{cleanSellerName(seller.profileData.name)}</span>
                            <span className={`report-score ${getPulseScoreClass(seller.pulseScore)}`}>
                              {seller.pulseScore}
                            </span>
                          </div>
                          <div className="report-meta">
                            {seller.platform} • {formatTimestamp(seller.extractedAt)}
                          </div>
                          <div className={`report-risk ${seller.pulseScore >= 75 ? 'trusted' : seller.pulseScore >= 45 ? 'uncertain' : 'avoid'}`}>
                            {seller.pulseScore >= 75 && '✅ '}
                            {seller.pulseScore >= 45 && seller.pulseScore < 75 && '⚠️ '}
                            {seller.pulseScore < 45 && '❌ '}
                            {seller.pulseScore >= 75 ? 'Trusted' : seller.pulseScore >= 45 ? 'Uncertain' : 'Avoid'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state-modern">
                  <div className="empty-icon">📋</div>
                  <p>No extractions found</p>
                  <p className="empty-hint">Start extracting sellers to see reports</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`nav-tab ${activeTab === 'analyses' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyses')}
          >
            Analyses
          </button>
          <button
            className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
          <button
            className={`nav-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              {/* Stats Grid */}
              {stats.totalAnalyses > 0 && (
                <div className="stats-grid-modern">
                  <div className="stat-card-modern">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                      <div className="stat-value">{stats.totalAnalyses}</div>
                      <div className="stat-label">Total Analyses</div>
                    </div>
                  </div>
                  <div className="stat-card-modern">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <div className="stat-value">{stats.trustedCount}</div>
                      <div className="stat-label">Trusted</div>
                    </div>
                  </div>
                  <div className="stat-card-modern">
                    <div className="stat-icon">⚠️</div>
                    <div className="stat-content">
                      <div className="stat-value">{stats.totalAnalyses - stats.trustedCount - stats.avoidCount}</div>
                      <div className="stat-label">Uncertain</div>
                    </div>
                  </div>
                  <div className="stat-card-modern">
                    <div className="stat-icon">❌</div>
                    <div className="stat-content">
                      <div className="stat-value">{stats.avoidCount}</div>
                      <div className="stat-label">Avoided</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Most Recent Analysis Card */}
              {currentAnalysis && (
                <div className="recent-analysis-card">
                  <div className="card-header">
                    <h3>Most Recent Analysis</h3>
                    <span className="card-time">{formatTimestamp(currentAnalysis.timestamp)}</span>
                  </div>
                  <div className="card-content">
                    <div className="seller-header">
                      <div className="seller-avatar">
                        {getPlatformIcon(currentAnalysis.platform)}
                      </div>
                      <div className="seller-details">
                        <div className="seller-name-main">{currentAnalysis.sellerName}</div>
                        <div className="seller-platform">{currentAnalysis.platform}</div>
                      </div>
                      <div className={`trust-score-badge ${getScoreClass(currentAnalysis.score)}`}>
                        {currentAnalysis.score}
                      </div>
                    </div>
                    <div className={`risk-badge-modern ${getRiskBadgeClass(currentAnalysis.riskLevel)}`}>
                      {currentAnalysis.riskLevel === 'Trusted' && '✅ '}
                      {currentAnalysis.riskLevel === 'Uncertain' && '⚠️ '}
                      {currentAnalysis.riskLevel === 'Avoid' && '❌ '}
                      {currentAnalysis.riskLevel}
                    </div>
                    {currentAnalysis.price && (
                      <div className="analysis-detail">
                        <span className="detail-label">Price:</span>
                        <span className="detail-value">{currentAnalysis.price}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analyses' && (
            <div className="analyses-tab">
              <div className="tab-header">
                <h3>All Analyses</h3>
              </div>

              {/* Threats Section */}
              <div className="analyses-section">
                <div className="section-header">
                  <h4 className="section-title">Threats</h4>
                  {threatsData && threatsData.count > 0 && (
                    <span className="section-count">{threatsData.count} threats</span>
                  )}
                </div>

                {isLoadingThreats ? (
                  <div className="empty-state-modern">
                    <div className="loading-spinner"></div>
                    <p>Loading threats...</p>
                  </div>
                ) : threatsData && threatsData.threats.length > 0 ? (
                  (() => {
                    // Group threats by platform
                    const threatsByPlatform = threatsData.threats.reduce((acc, threat) => {
                      const platform = threat.platform;
                      if (!acc[platform]) {
                        acc[platform] = [];
                      }
                      acc[platform].push(threat);
                      return acc;
                    }, {} as Record<string, typeof threatsData.threats>);

                    return (
                      <div className="threats-container">
                        {Object.entries(threatsByPlatform).map(([platform, threats]) => (
                          <div key={platform} className="platform-threats-group">
                            <div className="platform-header">
                              <div className="platform-header-content">
                                <span className="platform-icon-large">{getPlatformIcon(platform.toLowerCase())}</span>
                                <h5 className="platform-name">{platform}</h5>
                                <span className="platform-threat-count">{threats.length} {threats.length === 1 ? 'threat' : 'threats'}</span>
                              </div>
                            </div>
                            <div className="threats-list">
                              {threats.map((threat) => (
                                <div
                                  key={threat.sellerId}
                                  className="threat-item"
                                  onClick={() => {
                                    // Try to fetch seller details and view
                                    const sellerObj: Seller = {
                                      _id: threat.sellerId,
                                      sellerId: threat.sellerId,
                                      platform: threat.platform.toLowerCase(),
                                      profileUrl: '',
                                      pulseScore: threat.riskScore,
                                      confidenceLevel: threat.severity === 'HIGH' ? 'low' : threat.severity === 'MEDIUM' ? 'medium' : 'high',
                                      verificationStatus: 'unverified',
                                      isActive: true,
                                      isClaimed: false,
                                      profileData: {
                                        name: cleanSellerName(threat.sellerName),
                                        profilePicture: null,
                                        location: threat.location,
                                        bio: ''
                                      },
                                      marketplaceData: {
                                        accountAge: 0,
                                        totalListings: 0,
                                        avgRating: 0,
                                        totalReviews: 0,
                                        responseRate: 0,
                                        verificationStatus: 'unverified',
                                        followers: 0,
                                        categories: []
                                      }
                                    };
                                    handleViewSeller(sellerObj);
                                  }}
                                >
                                  <div className="threat-severity-badge" data-severity={threat.severity.toLowerCase()}>
                                    {threat.severity === 'HIGH' && '🔴'}
                                    {threat.severity === 'MEDIUM' && '🟡'}
                                    {threat.severity === 'LOW' && '🟢'}
                                    <span className="severity-text">{threat.severity}</span>
                                  </div>
                                  <div className="threat-content">
                                    <div className="threat-header">
                                      <div className="threat-seller-name">{cleanSellerName(threat.sellerName)}</div>
                                      <div className="threat-risk-score">
                                        <span className="risk-score-label">Risk:</span>
                                        <span className={`risk-score-value ${getPulseScoreClass(threat.riskScore)}`}>
                                          {threat.riskScore}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="threat-description">{threat.description}</div>
                                    <div className="threat-meta">
                                      <span className="threat-location">📍 {threat.location || 'Location not specified'}</span>
                                      <span className="threat-separator">•</span>
                                      <span className="threat-time">{threat.timeAgo}</span>
                                      {threat.usersAffected > 0 && (
                                        <>
                                          <span className="threat-separator">•</span>
                                          <span className="threat-users-affected">👥 {threat.usersAffected} {threat.usersAffected === 1 ? 'user' : 'users'} affected</span>
                                        </>
                                      )}
                                      {threat.flagCount > 0 && (
                                        <>
                                          <span className="threat-separator">•</span>
                                          <span className="threat-flags">🚩 {threat.flagCount} {threat.flagCount === 1 ? 'flag' : 'flags'}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  <div className="empty-state-modern">
                    <div className="empty-icon">🛡️</div>
                    <p>No threats found</p>
                    <p className="empty-hint">All clear! No threats detected at this time.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-tab">
              <div className="tab-header">
                <h3>Recent Activity</h3>
                {recentActivity && recentActivity.summary.total > 0 && (
                  <span className="tab-count">{recentActivity.summary.total} activities</span>
                )}
              </div>
              {isLoadingActivity ? (
                <div className="empty-state-modern">
                  <div className="loading-spinner"></div>
                  <p>Loading activity...</p>
                </div>
              ) : recentActivity && recentActivity.activities.length > 0 ? (
                <>
                  {/* Activity Summary */}
                  {recentActivity.summary.total > 0 && (
                    <div className="activity-summary-cards">
                      {recentActivity.summary.byType.extraction !== undefined && recentActivity.summary.byType.extraction > 0 && (
                        <div className="activity-summary-card extraction">
                          <div className="summary-icon">🔍</div>
                          <div className="summary-content">
                            <div className="summary-value">{recentActivity.summary.byType.extraction}</div>
                            <div className="summary-label">Extractions</div>
                          </div>
                        </div>
                      )}
                      {recentActivity.summary.byType.endorsement !== undefined && recentActivity.summary.byType.endorsement > 0 && (
                        <div className="activity-summary-card endorsement">
                          <div className="summary-icon">✅</div>
                          <div className="summary-content">
                            <div className="summary-value">{recentActivity.summary.byType.endorsement}</div>
                            <div className="summary-label">Endorsements</div>
                          </div>
                        </div>
                      )}
                      {recentActivity.summary.byType.flag !== undefined && recentActivity.summary.byType.flag > 0 && (
                        <div className="activity-summary-card flag">
                          <div className="summary-icon">🚩</div>
                          <div className="summary-content">
                            <div className="summary-value">{recentActivity.summary.byType.flag}</div>
                            <div className="summary-label">Flags</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activity Feed */}
                  <div className="activity-feed">
                    {recentActivity.activities.map((activity, idx) => (
                      <div key={`${activity.type}-${activity.timestamp}-${idx}`} className={`activity-item activity-${activity.type}`}>
                        <div className="activity-timeline">
                          <div className="activity-icon">
                            {activity.type === 'extraction' && '🔍'}
                            {activity.type === 'endorsement' && '✅'}
                            {activity.type === 'flag' && '🚩'}
                          </div>
                          {idx < recentActivity.activities.length - 1 && <div className="activity-line"></div>}
                        </div>
                        <div className="activity-content">
                          <div className="activity-header">
                            <div className="activity-type-badge">
                              <span className="activity-type-text">
                                {activity.type === 'extraction' && 'Seller Extracted'}
                                {activity.type === 'endorsement' && 'Seller Endorsed'}
                                {activity.type === 'flag' && 'Seller Flagged'}
                              </span>
                            </div>
                            <span className="activity-time">{formatTimestamp(activity.timestamp)}</span>
                          </div>
                          <div className="activity-seller-info">
                            <div className="activity-seller-avatar-small">
                              {(() => {
                                // Use placeholder for now since we don't have profile picture in activity
                                return (
                                  <div
                                    className="activity-avatar-placeholder"
                                    style={{ backgroundColor: getAvatarColor(activity.details.seller.name) }}
                                  >
                                    {getInitials(activity.details.seller.name)}
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="activity-seller-details">
                              <div className="activity-seller-name" onClick={() => {
                                // Create a seller object from activity data
                                const seller: Seller = {
                                  _id: activity.details.seller.id,
                                  sellerId: activity.details.seller.id,
                                  platform: activity.details.seller.platform,
                                  profileUrl: activity.details.seller.profileUrl,
                                  pulseScore: activity.details.seller.pulseScore,
                                  confidenceLevel: activity.details.seller.pulseScore >= 75 ? 'high' : activity.details.seller.pulseScore >= 45 ? 'medium' : 'low',
                                  verificationStatus: 'unverified',
                                  isActive: true,
                                  isClaimed: false,
                                  profileData: {
                                    name: activity.details.seller.name,
                                    profilePicture: null,
                                    location: '',
                                    bio: ''
                                  },
                                  marketplaceData: {
                                    accountAge: 0,
                                    totalListings: 0,
                                    avgRating: 0,
                                    totalReviews: 0,
                                    responseRate: 0,
                                    verificationStatus: 'unverified',
                                    followers: 0,
                                    categories: []
                                  }
                                };
                                handleViewSeller(seller);
                              }}>
                                {cleanSellerName(activity.details.seller.name)}
                              </div>
                              <div className="activity-seller-meta">
                                {getPlatformIcon(activity.details.seller.platform)} {activity.details.seller.platform}
                                <span className="activity-pulse-score"> • {activity.details.seller.pulseScore}/100</span>
                              </div>
                            </div>
                          </div>
                          {activity.details.reason && (
                            <div className="activity-reason">
                              <span className="reason-label">
                                {activity.type === 'endorsement' ? 'Reason:' : activity.type === 'flag' ? 'Reason:' : ''}
                              </span>
                              <span className="reason-text">{activity.details.reason}</span>
                              {activity.details.isVerified !== undefined && (
                                <span className={`verification-badge-small ${activity.details.isVerified ? 'verified' : 'pending'}`}>
                                  {activity.details.isVerified ? '✓ Verified' : '○ Pending'}
                                </span>
                              )}
                            </div>
                          )}
                          {activity.type === 'extraction' && activity.details.pulseScoreAtExtraction !== undefined && (
                            <div className="activity-extraction-score">
                              <span className="extraction-label">Pulse Score at extraction:</span>
                              <span className={`extraction-score ${getPulseScoreClass(activity.details.pulseScoreAtExtraction)}`}>
                                {activity.details.pulseScoreAtExtraction}/100
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state-modern">
                  <div className="empty-icon">📜</div>
                  <p>No activity yet</p>
                  <p className="empty-hint">Your recent activities will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="activity-tab">
              <div className="activity-sub-tabs">
                <button
                  className={`activity-sub-tab ${activeActivitySubTab === 'feedbacks' ? 'active' : ''}`}
                  onClick={() => setActiveActivitySubTab('feedbacks')}
                >
                  My Feedbacks
                </button>
                <button
                  className={`activity-sub-tab ${activeActivitySubTab === 'interactions' ? 'active' : ''}`}
                  onClick={() => setActiveActivitySubTab('interactions')}
                >
                  My Interactions
                </button>
              </div>

              {activeActivitySubTab === 'feedbacks' && (
                <div className="activity-sub-content">
                  <div className="tab-header">
                    <h3>My Feedbacks</h3>
                    {feedbackData && feedbackData.totalInteractions > 0 && (
                      <span className="tab-count">{feedbackData.totalInteractions} interactions</span>
                    )}
                  </div>
                  {isLoadingFeedback ? (
                    <div className="empty-state-modern">
                      <div className="loading-spinner"></div>
                      <p>Loading feedbacks...</p>
                    </div>
                  ) : feedbackData && feedbackData.feedbackHistory.length > 0 ? (
                    <div className="feedback-list">
                      {feedbackData.feedbackHistory.map((feedback, index) => (
                        <div key={`${feedback.seller.id}-${index}`} className="feedback-card">
                          <div className="feedback-card-header">
                            <div className="feedback-seller-info">
                              <div className="feedback-seller-name">
                                {cleanSellerName(feedback.seller.name)}
                              </div>
                              <div className="feedback-seller-meta">
                                {getPlatformIcon(feedback.seller.platform)} {feedback.seller.platform} •
                                <span className="feedback-pulse-score"> {feedback.seller.pulseScore}/100</span>
                              </div>
                            </div>
                          </div>

                          <div className="feedback-card-body">
                            {feedback.flag && (
                              <div className="feedback-item flag-item">
                                <div className="feedback-item-header">
                                  <div className="feedback-type">
                                    <span className="feedback-icon">🚩</span>
                                    <span className="feedback-type-label">Flag</span>
                                  </div>
                                  <button
                                    className="feedback-delete-btn"
                                    onClick={() => handleDeleteFlag(feedback.seller.id)}
                                    title="Delete Flag"
                                  >
                                    🗑️
                                  </button>
                                </div>
                                <div className="feedback-reason">{feedback.flag.reason}</div>
                                <div className="feedback-meta">
                                  <span className="feedback-time">{formatTimestamp(feedback.flag.timestamp)}</span>
                                  {feedback.flag.isVerified && (
                                    <span className="feedback-verified">✓ Verified</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {feedback.endorsement && (
                              <div className="feedback-item endorsement-item">
                                <div className="feedback-item-header">
                                  <div className="feedback-type">
                                    <span className="feedback-icon">✅</span>
                                    <span className="feedback-type-label">Endorsement</span>
                                  </div>
                                  <button
                                    className="feedback-delete-btn"
                                    onClick={() => handleDeleteEndorsement(feedback.seller.id)}
                                    title="Delete Endorsement"
                                  >
                                    🗑️
                                  </button>
                                </div>
                                <div className="feedback-reason">{feedback.endorsement.reason}</div>
                                <div className="feedback-meta">
                                  <span className="feedback-time">{formatTimestamp(feedback.endorsement.timestamp)}</span>
                                  {feedback.endorsement.isVerified && (
                                    <span className="feedback-verified">✓ Verified</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-modern">
                      <div className="empty-icon">💬</div>
                      <p>No feedbacks yet</p>
                      <p className="empty-hint">Your flags and endorsements will appear here</p>
                    </div>
                  )}
                </div>
              )}

              {activeActivitySubTab === 'interactions' && (
                <div className="activity-sub-content">
                  <div className="tab-header">
                    <h3>My Interactions</h3>
                    {interactionsData && interactionsData.summary.totalInteractions > 0 && (
                      <span className="tab-count">{interactionsData.summary.totalInteractions} total</span>
                    )}
                  </div>
                  {isLoadingInteractions ? (
                    <div className="empty-state-modern">
                      <div className="loading-spinner"></div>
                      <p>Loading interactions...</p>
                    </div>
                  ) : interactionsData ? (
                    <div className="interactions-content">
                      {/* Summary Stats */}
                      {interactionsData.summary.totalInteractions > 0 && (
                        <div className="interactions-summary">
                          <div className="summary-stat">
                            <div className="summary-stat-value">{interactionsData.summary.totalFlags}</div>
                            <div className="summary-stat-label">Flags</div>
                          </div>
                          <div className="summary-stat">
                            <div className="summary-stat-value">{interactionsData.summary.totalEndorsements}</div>
                            <div className="summary-stat-label">Endorsements</div>
                          </div>
                          <div className="summary-stat">
                            <div className="summary-stat-value">{interactionsData.summary.totalInteractions}</div>
                            <div className="summary-stat-label">Total</div>
                          </div>
                        </div>
                      )}

                      {/* Flagged Sellers Section */}
                      {interactionsData.interactions.flagged.length > 0 && (
                        <div className="interactions-section">
                          <div className="interactions-section-header">
                            <span className="section-icon">🚩</span>
                            <h4>Flagged Sellers ({interactionsData.interactions.flagged.length})</h4>
                          </div>
                          <div className="interactions-list">
                            {interactionsData.interactions.flagged.map((item, index) => (
                              <div key={`flagged-${item.seller.id}-${index}`} className="interaction-card flag-card">
                                <div className="interaction-card-header">
                                  <div className="interaction-seller-info">
                                    <div className="interaction-seller-name">
                                      {cleanSellerName(item.seller.name)}
                                    </div>
                                    <div className="interaction-seller-meta">
                                      {getPlatformIcon(item.seller.platform)} {item.seller.platform} •
                                      <span className="interaction-pulse-score"> {item.seller.pulseScore}/100</span>
                                    </div>
                                  </div>
                                  <button
                                    className="interaction-delete-btn"
                                    onClick={() => handleDeleteFlag(item.seller.id)}
                                    title="Delete Flag"
                                  >
                                    🗑️
                                  </button>
                                </div>
                                <div className="interaction-card-body">
                                  <div className="interaction-reason">
                                    <span className="interaction-label">Reason:</span>
                                    {item.flag.reason}
                                  </div>
                                  <div className="interaction-meta">
                                    <span className="interaction-time">{formatTimestamp(item.flag.timestamp)}</span>
                                    {item.flag.isVerified && (
                                      <span className="interaction-verified">✓ Verified</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Endorsed Sellers Section */}
                      {interactionsData.interactions.endorsed.length > 0 && (
                        <div className="interactions-section">
                          <div className="interactions-section-header">
                            <span className="section-icon">✅</span>
                            <h4>Endorsed Sellers ({interactionsData.interactions.endorsed.length})</h4>
                          </div>
                          <div className="interactions-list">
                            {interactionsData.interactions.endorsed.map((item, index) => (
                              <div key={`endorsed-${item.seller.id}-${index}`} className="interaction-card endorsement-card">
                                <div className="interaction-card-header">
                                  <div className="interaction-seller-info">
                                    <div className="interaction-seller-name">
                                      {cleanSellerName(item.seller.name)}
                                    </div>
                                    <div className="interaction-seller-meta">
                                      {getPlatformIcon(item.seller.platform)} {item.seller.platform} •
                                      <span className="interaction-pulse-score"> {item.seller.pulseScore}/100</span>
                                    </div>
                                  </div>
                                  <button
                                    className="interaction-delete-btn"
                                    onClick={() => handleDeleteEndorsement(item.seller.id)}
                                    title="Delete Endorsement"
                                  >
                                    🗑️
                                  </button>
                                </div>
                                <div className="interaction-card-body">
                                  <div className="interaction-reason">
                                    <span className="interaction-label">Reason:</span>
                                    {item.endorsement.reason}
                                  </div>
                                  <div className="interaction-meta">
                                    <span className="interaction-time">{formatTimestamp(item.endorsement.timestamp)}</span>
                                    {item.endorsement.isVerified && (
                                      <span className="interaction-verified">✓ Verified</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty State */}
                      {interactionsData.summary.totalInteractions === 0 && (
                        <div className="empty-state-modern">
                          <div className="empty-icon">⚡</div>
                          <p>No interactions yet</p>
                          <p className="empty-hint">Your flags and endorsements will appear here</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state-modern">
                      <div className="empty-icon">⚡</div>
                      <p>No interactions yet</p>
                      <p className="empty-hint">Your seller analysis history will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search Results Modal - Trustpilot Style */}
      {searchResults && searchResults.seller && (
        <div className="modal-overlay" onClick={() => setSearchResults(null)}>
          <div className="modal-content search-results-analysis-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header search-results-header">
              <div className="search-results-header-content">
                <h2 className="search-results-title">Seller Trust Analysis</h2>
                <p className="search-results-subtitle">Comprehensive trustworthiness assessment</p>
              </div>
              <button className="modal-close" onClick={() => setSearchResults(null)}>×</button>
            </div>

            <div className="modal-body search-results-body">
              {/* Seller Profile Card */}
              <div className="search-results-card profile-card">
                <div className="profile-card-header">
                  <div className="profile-avatar-section">
                    {(() => {
                      const seller = searchResults.seller;
                      const cleanedPic = cleanProfilePicture(seller.profileData?.profilePicture);
                      return cleanedPic ? (
                        <img
                          src={cleanedPic}
                          alt={cleanSellerName(seller.profileData?.name)}
                          className="profile-avatar-large"
                          onError={(e) => handleImageError(e, seller.profileData?.name || 'Seller')}
                        />
                      ) : (
                        <div
                          className="profile-avatar-placeholder-large"
                          style={{ backgroundColor: getAvatarColor(cleanSellerName(seller.profileData?.name || 'Seller')) }}
                        >
                          {getInitials(cleanSellerName(seller.profileData?.name || 'Seller'))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="profile-info-section">
                    <h3 className="profile-name-large">{cleanSellerName(searchResults.seller.profileData?.name || 'Unknown Seller')}</h3>
                    <div className="profile-meta-row">
                      <span className="platform-badge">
                        {getPlatformIcon(searchResults.seller.platform)} {searchResults.seller.platform}
                      </span>
                      {searchResults.seller.profileData?.location && searchResults.seller.profileData.location !== 'Not specified' && (
                        <span className="location-badge">📍 {searchResults.seller.profileData.location}</span>
                      )}
                    </div>
                    {searchResults.seller.profileUrl && (
                      <a
                        href={searchResults.seller.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile-link"
                      >
                        View Profile →
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Trust Score Card - Hero Section */}
              {searchResults.scoringResult && (
                <div className="search-results-card trust-score-hero">
                  <div className="trust-score-hero-content">
                    <div className="trust-score-main">
                      <div className="trust-score-label">Trust Score</div>
                      <div className={`trust-score-value-large ${getPulseScoreClass(searchResults.scoringResult.pulseScore)}`}>
                        {searchResults.scoringResult.pulseScore}
                        <span className="trust-score-max">/100</span>
                      </div>
                      <div className={`confidence-badge-hero ${getConfidenceClass((searchResults.scoringResult.confidenceLevel || 'Medium').toLowerCase())}`}>
                        {searchResults.scoringResult.confidenceLevel || 'Medium'} Confidence
                      </div>
                    </div>
                    <div className="trust-score-breakdown">
                      {searchResults.seller.scoringFactors && (
                        <div className="scoring-factors-mini">
                          {searchResults.seller.scoringFactors.verificationIdentity?.available && (
                            <div className="scoring-factor-mini">
                              <span className="factor-label">Verification</span>
                              <div className="factor-bar-mini">
                                <div
                                  className="factor-fill-mini"
                                  style={{ width: `${searchResults.seller.scoringFactors.verificationIdentity.score || 0}%` }}
                                ></div>
                              </div>
                              <span className="factor-value-mini">{searchResults.seller.scoringFactors.verificationIdentity.score || 0}%</span>
                            </div>
                          )}
                          {searchResults.seller.scoringFactors.listingCompleteness?.available && (
                            <div className="scoring-factor-mini">
                              <span className="factor-label">Listings</span>
                              <div className="factor-bar-mini">
                                <div
                                  className="factor-fill-mini"
                                  style={{ width: `${searchResults.seller.scoringFactors.listingCompleteness.score || 0}%` }}
                                ></div>
                              </div>
                              <span className="factor-value-mini">{searchResults.seller.scoringFactors.listingCompleteness.score || 0}%</span>
                            </div>
                          )}
                          {searchResults.seller.scoringFactors.communityFeedback?.available && (
                            <div className="scoring-factor-mini">
                              <span className="factor-label">Community</span>
                              <div className="factor-bar-mini">
                                <div
                                  className="factor-fill-mini"
                                  style={{ width: `${Math.max(0, searchResults.seller.scoringFactors.communityFeedback.score || 0)}%` }}
                                ></div>
                              </div>
                              <span className="factor-value-mini">{searchResults.seller.scoringFactors.communityFeedback.score || 0}%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations & Risk Factors */}
              {searchResults.scoringResult && (
                <div className="search-results-cards-row">
                  {/* Recommendations Card */}
                  {searchResults.scoringResult.recommendations && searchResults.scoringResult.recommendations.length > 0 && (
                    <div className="search-results-card recommendations-card">
                      <div className="card-section-header">
                        <span className="section-icon">💡</span>
                        <h4 className="section-title">Recommendations</h4>
                      </div>
                      <div className="recommendations-list-modern">
                        {searchResults.scoringResult.recommendations.map((rec: any, idx: number) => (
                          <div key={idx} className={`recommendation-item-modern ${rec.type}`}>
                            <div className="recommendation-header-modern">
                              <span className={`recommendation-type-badge ${rec.type}`}>
                                {rec.type === 'warning' ? '⚠️' : rec.type === 'positive' ? '✅' : 'ℹ️'}
                                {rec.type?.charAt(0).toUpperCase() + rec.type?.slice(1)}
                              </span>
                              {rec.priority && (
                                <span className="recommendation-priority">{rec.priority} priority</span>
                              )}
                            </div>
                            <p className="recommendation-message-modern">{rec.message}</p>
                            {rec.action && (
                              <div className="recommendation-action-modern">
                                <strong>Action:</strong> {rec.action}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk Factors Card */}
                  {searchResults.scoringResult.riskFactors && searchResults.scoringResult.riskFactors.length > 0 && (
                    <div className="search-results-card risk-factors-card">
                      <div className="card-section-header">
                        <span className="section-icon">⚠️</span>
                        <h4 className="section-title">Risk Factors</h4>
                      </div>
                      <div className="risk-factors-list-modern">
                        {searchResults.scoringResult.riskFactors.map((risk: any, idx: number) => (
                          <div key={idx} className="risk-factor-item-modern">
                            <div className="risk-factor-header">
                              <span className="risk-category">{risk.category || 'General'}</span>
                              {risk.severity && (
                                <span className={`risk-severity ${risk.severity}`}>
                                  {risk.severity}
                                </span>
                              )}
                            </div>
                            <p className="risk-issue">{risk.issue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Marketplace Statistics */}
              {searchResults.seller.marketplaceData && (
                <div className="search-results-card marketplace-stats-card">
                  <div className="card-section-header">
                    <span className="section-icon">📊</span>
                    <h4 className="section-title">Marketplace Statistics</h4>
                  </div>
                  <div className="marketplace-stats-grid-modern">
                    <div className="marketplace-stat-card">
                      <div className="stat-icon-modern">📦</div>
                      <div className="stat-content-modern">
                        <div className="stat-value-modern">{searchResults.seller.marketplaceData.totalListings || 0}</div>
                        <div className="stat-label-modern">Total Listings</div>
                      </div>
                    </div>
                    <div className="marketplace-stat-card">
                      <div className="stat-icon-modern">⭐</div>
                      <div className="stat-content-modern">
                        <div className="stat-value-modern">{searchResults.seller.marketplaceData.avgRating?.toFixed(1) || '0.0'}</div>
                        <div className="stat-label-modern">Avg Rating</div>
                      </div>
                    </div>
                    <div className="marketplace-stat-card">
                      <div className="stat-icon-modern">💬</div>
                      <div className="stat-content-modern">
                        <div className="stat-value-modern">{searchResults.seller.marketplaceData.totalReviews || 0}</div>
                        <div className="stat-label-modern">Reviews</div>
                      </div>
                    </div>
                    <div className="marketplace-stat-card">
                      <div className="stat-icon-modern">✅</div>
                      <div className="stat-content-modern">
                        <div className="stat-value-modern">
                          {searchResults.seller.marketplaceData.verificationStatus === 'id-verified' ? 'ID ✓' :
                            searchResults.seller.marketplaceData.verificationStatus === 'verified' ? '✓' :
                              '✗'}
                        </div>
                        <div className="stat-label-modern">Marketplace</div>
                      </div>
                    </div>
                    {searchResults.seller.marketplaceData.responseRate > 0 && (
                      <div className="marketplace-stat-card">
                        <div className="stat-icon-modern">📨</div>
                        <div className="stat-content-modern">
                          <div className="stat-value-modern">{searchResults.seller.marketplaceData.responseRate}%</div>
                          <div className="stat-label-modern">Response Rate</div>
                        </div>
                      </div>
                    )}
                    {searchResults.seller.marketplaceData.followers > 0 && (
                      <div className="marketplace-stat-card">
                        <div className="stat-icon-modern">👥</div>
                        <div className="stat-content-modern">
                          <div className="stat-value-modern">{searchResults.seller.marketplaceData.followers}</div>
                          <div className="stat-label-modern">Followers</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Verification Status */}
              <div className="search-results-card verification-status-card">
                <div className="card-section-header">
                  <span className="section-icon">🔐</span>
                  <h4 className="section-title">Verification Status</h4>
                </div>
                <div className="verification-status-grid">
                  <div className="verification-status-item">
                    <div className="verification-platform">
                      <span className="platform-icon">🏪</span>
                      <span className="platform-name">Marketplace</span>
                    </div>
                    <div className={`verification-badge ${searchResults.seller.marketplaceData?.verificationStatus === 'id-verified' || searchResults.seller.marketplaceData?.verificationStatus === 'verified' ? 'verified' : 'unverified'}`}>
                      {searchResults.seller.marketplaceData?.verificationStatus === 'id-verified' ? (
                        <>
                          <span className="badge-icon">✓</span>
                          <span className="badge-text">ID Verified</span>
                        </>
                      ) : searchResults.seller.marketplaceData?.verificationStatus === 'verified' ? (
                        <>
                          <span className="badge-icon">✓</span>
                          <span className="badge-text">Verified</span>
                        </>
                      ) : (
                        <>
                          <span className="badge-icon">✗</span>
                          <span className="badge-text">Not Verified</span>
                        </>
                      )}
                    </div>
                    <div className="verification-description">
                      {searchResults.seller.marketplaceData?.verificationStatus === 'id-verified'
                        ? 'Verified on the marketplace platform'
                        : searchResults.seller.marketplaceData?.verificationStatus === 'verified'
                          ? 'Verified on the marketplace platform'
                          : 'Not verified on the marketplace platform'}
                    </div>
                  </div>

                  <div className="verification-status-item">
                    <div className="verification-platform">
                      <span className="platform-icon">🛡️</span>
                      <span className="platform-name">Verible</span>
                    </div>
                    <div className={`verification-badge ${searchResults.seller.verificationStatus === 'verified' ? 'verified' : 'unverified'}`}>
                      {searchResults.seller.verificationStatus === 'verified' ? (
                        <>
                          <span className="badge-icon">✓</span>
                          <span className="badge-text">Verified</span>
                        </>
                      ) : (
                        <>
                          <span className="badge-icon">○</span>
                          <span className="badge-text">Not Verified</span>
                        </>
                      )}
                    </div>
                    <div className="verification-description">
                      {searchResults.seller.verificationStatus === 'verified'
                        ? 'Verified on Verible platform'
                        : 'Not yet verified on Verible platform'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories */}
              {searchResults.seller.marketplaceData?.categories && searchResults.seller.marketplaceData.categories.length > 0 && (() => {
                const validCategories = searchResults.seller.marketplaceData.categories
                  .map((cat: any) => ({
                    ...cat,
                    cleanedName: cleanCategoryName(cat.name)
                  }))
                  .filter((cat: any) => cat.cleanedName !== null);

                return validCategories.length > 0 ? (
                  <div className="search-results-card categories-card">
                    <div className="card-section-header">
                      <span className="section-icon">🏷️</span>
                      <h4 className="section-title">Categories ({validCategories.length})</h4>
                    </div>
                    <div className="categories-list-modern">
                      {validCategories.map((category: any, idx: number) => (
                        <div key={category._id || idx} className="category-badge-modern">
                          <span className="category-name">{category.cleanedName}</span>
                          {category.count !== undefined && category.count > 0 && (
                            <span className="category-count">({category.count})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Recent Listings */}
              {searchResults.seller.recentListings && searchResults.seller.recentListings.length > 0 && (
                <div className="search-results-card recent-listings-card">
                  <div className="card-section-header">
                    <span className="section-icon">🛍️</span>
                    <h4 className="section-title">Recent Listings ({searchResults.seller.recentListings.length})</h4>
                  </div>
                  <div className="recent-listings-grid">
                    {searchResults.seller.recentListings.slice(0, 5).map((listing: any, idx: number) => (
                      <div key={listing._id || idx} className="listing-item-modern">
                        <div className="listing-title-modern">{listing.title || 'Untitled Listing'}</div>
                        {listing.price && (
                          <div className="listing-price-modern">₦{parseInt(listing.price).toLocaleString()}</div>
                        )}
                        {listing.description && (
                          <div className="listing-description-modern">{listing.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trust Indicators */}
              {searchResults.seller.trustIndicators && (
                <div className="search-results-card trust-indicators-card">
                  <div className="card-section-header">
                    <span className="section-icon">🔍</span>
                    <h4 className="section-title">Trust Indicators</h4>
                  </div>
                  <div className="trust-indicators-grid-modern">
                    <div className="trust-indicator-item-modern">
                      <span className="indicator-label-modern">Profile Picture</span>
                      <span className={`indicator-status-modern ${searchResults.seller.trustIndicators.hasProfilePicture ? 'yes' : 'no'}`}>
                        {searchResults.seller.trustIndicators.hasProfilePicture ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div className="trust-indicator-item-modern">
                      <span className="indicator-label-modern">Location</span>
                      <span className={`indicator-status-modern ${searchResults.seller.trustIndicators.hasLocation ? 'yes' : 'no'}`}>
                        {searchResults.seller.trustIndicators.hasLocation ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div className="trust-indicator-item-modern">
                      <span className="indicator-label-modern">Bio</span>
                      <span className={`indicator-status-modern ${searchResults.seller.trustIndicators.hasBio ? 'yes' : 'no'}`}>
                        {searchResults.seller.trustIndicators.hasBio ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div className="trust-indicator-item-modern">
                      <span className="indicator-label-modern">Marketplace Verification</span>
                      <span className={`indicator-status-modern ${searchResults.seller.trustIndicators.verificationStatus !== 'unverified' ? 'yes' : 'no'}`}>
                        {searchResults.seller.trustIndicators.verificationStatus === 'id-verified' ? '✓ ID Verified' :
                          searchResults.seller.trustIndicators.verificationStatus === 'verified' ? '✓ Verified' :
                            '✗ Unverified'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="modal-footer search-results-footer">
              <button
                className="verible-btn secondary-btn"
                onClick={() => {
                  if (searchResults.seller) {
                    handleViewSeller(searchResults.seller);
                    setSearchResults(null);
                  }
                }}
              >
                View Full Details
              </button>
              <button
                className="verible-btn primary-btn"
                onClick={() => setSearchResults(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Become A Seller Modal */}
      {showBecomeSeller && (
        <div className="modal-overlay" onClick={() => setShowBecomeSeller(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Become A Seller</h3>
              <button className="modal-close" onClick={() => setShowBecomeSeller(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="platform-select">Select Platform</label>
                <select
                  id="platform-select"
                  className="form-input"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                >
                  <option value="">Choose a platform...</option>
                  <option value="facebook">Facebook Marketplace</option>
                  <option value="jiji">Jiji.ng</option>
                  <option value="craigslist">Craigslist</option>
                  <option value="offerup">OfferUp</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="profile-url">Profile URL</label>
                <input
                  id="profile-url"
                  type="text"
                  className="form-input"
                  placeholder="Paste your seller profile URL here..."
                  value={sellerProfileUrl}
                  onChange={(e) => setSellerProfileUrl(e.target.value)}
                />
                <small className="form-hint">Enter the full URL of your seller profile on the selected platform</small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="verible-btn secondary-btn"
                onClick={() => {
                  setShowBecomeSeller(false);
                  setSelectedPlatform('');
                  setSellerProfileUrl('');
                }}
              >
                Cancel
              </button>
              <button
                className="verible-btn primary-btn"
                onClick={handleBecomeSeller}
                disabled={isSubmittingSeller || !selectedPlatform || !sellerProfileUrl.trim()}
              >
                {isSubmittingSeller ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seller Detail Modal */}
      {showSellerDetail && (
        <div className="modal-overlay" onClick={() => setShowSellerDetail(false)}>
          <div className="modal-content seller-detail-modal" onClick={(e) => e.stopPropagation()}>
            {isLoadingSellerDetail ? (
              <div className="modal-body" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="loading-spinner"></div>
                <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading seller details...</p>
              </div>
            ) : selectedSeller ? (
              <>
                <div className="modal-header seller-detail-header">
                  <div className="seller-detail-title-section">
                    <div className="seller-detail-avatar-large">
                      {(() => {
                        const cleanedPic = cleanProfilePicture(selectedSeller.profileData.profilePicture);
                        return cleanedPic ? (
                          <img
                            src={cleanedPic}
                            alt={cleanSellerName(selectedSeller.profileData.name)}
                            className="seller-detail-avatar-img"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '';
                                const placeholder = document.createElement('div');
                                placeholder.className = 'seller-detail-avatar-placeholder';
                                placeholder.style.backgroundColor = getAvatarColor(selectedSeller.profileData.name);
                                placeholder.textContent = getInitials(selectedSeller.profileData.name);
                                parent.appendChild(placeholder);
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="seller-detail-avatar-placeholder"
                            style={{ backgroundColor: getAvatarColor(selectedSeller.profileData.name) }}
                          >
                            {getInitials(selectedSeller.profileData.name)}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="seller-detail-title-info">
                      <h2 className="seller-detail-name">{cleanSellerName(selectedSeller.profileData.name)}</h2>
                      <div className="seller-detail-platform-info">
                        {getPlatformIcon(selectedSeller.platform)} {selectedSeller.platform}
                      </div>
                    </div>
                  </div>
                  <button className="modal-close" onClick={() => setShowSellerDetail(false)}>×</button>
                </div>

                <div className="modal-body seller-detail-body">
                  {/* Pulse Score Section */}
                  <div className="seller-detail-section pulse-score-section">
                    <div className="pulse-score-main">
                      <div className="pulse-score-large">
                        {selectedSeller.pulseScore}
                        <span className="pulse-score-max-large">/100</span>
                      </div>
                      <div className={`confidence-badge-large ${getConfidenceClass(selectedSeller.confidenceLevel)}`}>
                        {selectedSeller.confidenceLevel.toUpperCase()} Confidence
                      </div>
                    </div>
                  </div>

                  {/* Profile Information */}
                  <div className="seller-detail-section">
                    <h3 className="section-title">Profile Information</h3>
                    <div className="info-grid">
                      <div className="info-item-detail">
                        <span className="info-label">Location</span>
                        <span className="info-value">{selectedSeller.profileData.location || 'Not specified'}</span>
                      </div>
                      {selectedSeller.profileData.bio && (
                        <div className="info-item-detail full-width">
                          <span className="info-label">Bio</span>
                          <span className="info-value">{selectedSeller.profileData.bio}</span>
                        </div>
                      )}
                      <div className="info-item-detail">
                        <span className="info-label">Status</span>
                        <span className={`info-value ${selectedSeller.isActive ? 'active' : 'inactive'}`}>
                          {selectedSeller.isActive ? '✓ Active' : '✗ Inactive'}
                        </span>
                      </div>
                      <div className="info-item-detail">
                        <span className="info-label">Claimed</span>
                        <span className={`info-value ${selectedSeller.isClaimed ? 'claimed' : 'unclaimed'}`}>
                          {selectedSeller.isClaimed ? '✓ Claimed' : '○ Unclaimed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Marketplace Statistics */}
                  <div className="seller-detail-section">
                    <h3 className="section-title">Marketplace Statistics</h3>
                    <div className="stats-grid-detail">
                      <div className="stat-card-detail">
                        <div className="stat-icon-detail">📦</div>
                        <div className="stat-content-detail">
                          <div className="stat-value-detail">{selectedSeller.marketplaceData.totalListings}</div>
                          <div className="stat-label-detail">Total Listings</div>
                        </div>
                      </div>
                      <div className="stat-card-detail">
                        <div className="stat-icon-detail">⭐</div>
                        <div className="stat-content-detail">
                          <div className="stat-value-detail">{selectedSeller.marketplaceData.avgRating || 'N/A'}</div>
                          <div className="stat-label-detail">Avg Rating</div>
                        </div>
                      </div>
                      <div className="stat-card-detail">
                        <div className="stat-icon-detail">💬</div>
                        <div className="stat-content-detail">
                          <div className="stat-value-detail">{selectedSeller.marketplaceData.totalReviews}</div>
                          <div className="stat-label-detail">Total Reviews</div>
                        </div>
                      </div>
                      <div className="stat-card-detail">
                        <div className="stat-icon-detail">👥</div>
                        <div className="stat-content-detail">
                          <div className="stat-value-detail">{selectedSeller.marketplaceData.followers}</div>
                          <div className="stat-label-detail">Followers</div>
                        </div>
                      </div>
                      <div className="stat-card-detail">
                        <div className="stat-icon-detail">📅</div>
                        <div className="stat-content-detail">
                          <div className="stat-value-detail">{selectedSeller.marketplaceData.accountAge || 0}</div>
                          <div className="stat-label-detail">Account Age (days)</div>
                        </div>
                      </div>
                      <div className="stat-card-detail">
                        <div className="stat-icon-detail">💬</div>
                        <div className="stat-content-detail">
                          <div className="stat-value-detail">{selectedSeller.marketplaceData.responseRate || 0}%</div>
                          <div className="stat-label-detail">Response Rate</div>
                        </div>
                      </div>
                    </div>
                    {selectedSeller.marketplaceData.lastSeen && (
                      <div className="info-item-detail" style={{ marginTop: '12px' }}>
                        <span className="info-label">Last Seen</span>
                        <span className="info-value">{selectedSeller.marketplaceData.lastSeen}</span>
                      </div>
                    )}
                    {selectedSeller.marketplaceData.categories && selectedSeller.marketplaceData.categories.length > 0 && (
                      <div className="categories-section" style={{ marginTop: '16px' }}>
                        <span className="info-label" style={{ marginBottom: '8px', display: 'block' }}>Categories</span>
                        <div className="categories-list">
                          {selectedSeller.marketplaceData.categories.map((category, idx) => (
                            <span key={category._id || idx} className="category-badge">
                              {cleanSellerName(category.name)} ({category.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Trust Indicators */}
                  {selectedSeller.trustIndicators && (
                    <div className="seller-detail-section">
                      <h3 className="section-title">Trust Indicators</h3>
                      <div className="trust-indicators-grid">
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Profile Picture</span>
                          <span className={`indicator-status ${selectedSeller.trustIndicators.hasProfilePicture ? 'yes' : 'no'}`}>
                            {selectedSeller.trustIndicators.hasProfilePicture ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Location</span>
                          <span className={`indicator-status ${selectedSeller.trustIndicators.hasLocation ? 'yes' : 'no'}`}>
                            {selectedSeller.trustIndicators.hasLocation ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Bio</span>
                          <span className={`indicator-status ${selectedSeller.trustIndicators.hasBio ? 'yes' : 'no'}`}>
                            {selectedSeller.trustIndicators.hasBio ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Verification</span>
                          <span className={`indicator-status ${selectedSeller.trustIndicators.verificationStatus !== 'unverified' ? 'yes' : 'no'}`}>
                            {selectedSeller.trustIndicators.verificationStatus !== 'unverified' ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Account Age</span>
                          <span className="indicator-value">{selectedSeller.trustIndicators.accountAge || 0} days</span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Total Reviews</span>
                          <span className="indicator-value">{selectedSeller.trustIndicators.totalReviews || 0}</span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Avg Rating</span>
                          <span className="indicator-value">{selectedSeller.trustIndicators.avgRating || 0}</span>
                        </div>
                        <div className="trust-indicator-item">
                          <span className="indicator-label">Followers</span>
                          <span className="indicator-value">{selectedSeller.trustIndicators.followers || 0}</span>
                        </div>
                        {selectedSeller.trustIndicators.lastSeen && (
                          <div className="trust-indicator-item">
                            <span className="indicator-label">Last Seen</span>
                            <span className="indicator-value">{selectedSeller.trustIndicators.lastSeen}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scoring Factors */}
                  {selectedSeller.scoringFactors && (
                    <div className="seller-detail-section">
                      <h3 className="section-title">Scoring Factors</h3>
                      <div className="scoring-factors-grid">
                        <div className="scoring-factor-item">
                          <span className="scoring-factor-label">Profile Completeness</span>
                          <div className="scoring-factor-bar">
                            <div
                              className="scoring-factor-fill"
                              style={{ width: `${selectedSeller.scoringFactors.profileCompleteness || 0}%` }}
                            ></div>
                            <span className="scoring-factor-value">{selectedSeller.scoringFactors.profileCompleteness || 0}%</span>
                          </div>
                        </div>
                        {selectedSeller.scoringFactors.urgencyScore !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Urgency Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.urgencyScore || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.urgencyScore || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.accountAge !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Account Age Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.accountAge || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.accountAge || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.verificationStatus !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Verification Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.verificationStatus || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.verificationStatus || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.ratingScore !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Rating Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.ratingScore || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.ratingScore || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.reviewCount !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Review Count Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.reviewCount || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.reviewCount || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.responseRate !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Response Rate Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.responseRate || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.responseRate || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.listingQuality !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Listing Quality Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.listingQuality || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.listingQuality || 0}%</span>
                            </div>
                          </div>
                        )}
                        {selectedSeller.scoringFactors.activityScore !== undefined && (
                          <div className="scoring-factor-item">
                            <span className="scoring-factor-label">Activity Score</span>
                            <div className="scoring-factor-bar">
                              <div
                                className="scoring-factor-fill"
                                style={{ width: `${selectedSeller.scoringFactors.activityScore || 0}%` }}
                              ></div>
                              <span className="scoring-factor-value">{selectedSeller.scoringFactors.activityScore || 0}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recommendations & Risk Factors */}
                  {sellerDetailData?.scoringResult && (
                    <>
                      {sellerDetailData.scoringResult.recommendations && sellerDetailData.scoringResult.recommendations.length > 0 && (
                        <div className="seller-detail-section">
                          <h3 className="section-title">Recommendations</h3>
                          <div className="recommendations-list">
                            {sellerDetailData.scoringResult.recommendations.map((rec, idx) => (
                              <div key={idx} className={`recommendation-item ${rec.type}`}>
                                <div className="recommendation-header">
                                  <span className={`recommendation-type ${rec.type}`}>
                                    {rec.type === 'warning' ? '⚠️' : rec.type === 'info' ? 'ℹ️' : '✅'}
                                    {rec.type.toUpperCase()}
                                  </span>
                                </div>
                                <div className="recommendation-message">{rec.message}</div>
                                <div className="recommendation-action">
                                  <span className="recommendation-action-label">Action:</span>
                                  <span className="recommendation-action-text">{rec.action}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sellerDetailData.scoringResult.trustIndicators && (
                        <div className="seller-detail-section">
                          <h3 className="section-title">Trust Score Breakdown</h3>
                          <div className="trust-breakdown-grid">
                            <div className="trust-breakdown-item">
                              <span className="breakdown-label">Account Verification</span>
                              <span className="breakdown-value">{sellerDetailData.scoringResult.trustIndicators.accountVerification}</span>
                            </div>
                            <div className="trust-breakdown-item">
                              <span className="breakdown-label">Transaction History</span>
                              <span className="breakdown-value">{sellerDetailData.scoringResult.trustIndicators.transactionHistory}</span>
                            </div>
                            <div className="trust-breakdown-item">
                              <span className="breakdown-label">Communication Quality</span>
                              <span className="breakdown-value">{sellerDetailData.scoringResult.trustIndicators.communicationQuality}</span>
                            </div>
                            <div className="trust-breakdown-item">
                              <span className="breakdown-label">Dispute Resolution</span>
                              <span className="breakdown-value">{sellerDetailData.scoringResult.trustIndicators.disputeResolution}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sellerDetailData.scoringResult.riskFactors && sellerDetailData.scoringResult.riskFactors.length > 0 && (
                        <div className="seller-detail-section">
                          <h3 className="section-title">Risk Factors</h3>
                          <div className="risk-factors-list">
                            {sellerDetailData.scoringResult.riskFactors.map((risk: any, idx: number) => (
                              <div key={idx} className="risk-factor-item">
                                <span className="risk-icon">⚠️</span>
                                <div className="risk-factor-content">
                                  {typeof risk === 'string' ? (
                                    <span className="risk-text">{risk}</span>
                                  ) : (
                                    <>
                                      <div className="risk-factor-header">
                                        {risk.category && (
                                          <span className="risk-category">{risk.category}</span>
                                        )}
                                        {risk.severity && (
                                          <span className={`risk-severity ${risk.severity.toLowerCase()}`}>
                                            {risk.severity}
                                          </span>
                                        )}
                                      </div>
                                      <span className="risk-text">{risk.issue || risk}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Account Timeline */}
                  <div className="seller-detail-section">
                    <h3 className="section-title">Account Timeline</h3>
                    <div className="timeline-grid">
                      {selectedSeller.firstSeen && (
                        <div className="info-item-detail">
                          <span className="info-label">First Seen</span>
                          <span className="info-value">{formatTimestamp(selectedSeller.firstSeen)}</span>
                        </div>
                      )}
                      {selectedSeller.lastSeen && (
                        <div className="info-item-detail">
                          <span className="info-label">Last Seen</span>
                          <span className="info-value">{formatTimestamp(selectedSeller.lastSeen)}</span>
                        </div>
                      )}
                      {selectedSeller.lastScored && (
                        <div className="info-item-detail">
                          <span className="info-label">Last Scored</span>
                          <span className="info-value">{formatTimestamp(selectedSeller.lastScored)}</span>
                        </div>
                      )}
                      {selectedSeller.createdAt && (
                        <div className="info-item-detail">
                          <span className="info-label">Created At</span>
                          <span className="info-value">{formatTimestamp(selectedSeller.createdAt)}</span>
                        </div>
                      )}
                      {selectedSeller.updatedAt && (
                        <div className="info-item-detail">
                          <span className="info-label">Updated At</span>
                          <span className="info-value">{formatTimestamp(selectedSeller.updatedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feedback Summary */}
                  {(selectedSeller.flags || selectedSeller.endorsements) && (
                    <div className="seller-detail-section">
                      <h3 className="section-title">Feedback Summary</h3>
                      <div className="feedback-summary-grid">
                        <div className="feedback-summary-item">
                          <span className="feedback-summary-icon">🚩</span>
                          <span className="feedback-summary-label">Flags</span>
                          <span className="feedback-summary-value">{selectedSeller.flags?.length || 0}</span>
                        </div>
                        <div className="feedback-summary-item">
                          <span className="feedback-summary-icon">✅</span>
                          <span className="feedback-summary-label">Endorsements</span>
                          <span className="feedback-summary-value">{selectedSeller.endorsements?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profile URL */}
                  <div className="seller-detail-section">
                    <h3 className="section-title">Profile URL</h3>
                    <a
                      href={selectedSeller.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="profile-url-link"
                    >
                      {selectedSeller.profileUrl}
                    </a>
                  </div>
                </div>

                <div className="modal-footer seller-detail-footer">
                  <button
                    className="action-button-large flag-btn-large"
                    onClick={() => handleFlagSeller(selectedSeller)}
                  >
                    🚩 Flag
                  </button>
                  <button
                    className="action-button-large endorse-btn-large"
                    onClick={() => handleEndorseSeller(selectedSeller)}
                  >
                    ✅ Endorse
                  </button>
                  <button
                    className="action-button-large close-btn-large"
                    onClick={() => setShowSellerDetail(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Flag Seller Modal */}
      {showFlagModal && selectedSeller && (
        <div className="modal-overlay" onClick={() => setShowFlagModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Flag Seller</h3>
              <button className="modal-close" onClick={() => setShowFlagModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="flag-seller-info">
                <p>You are about to flag:</p>
                <div className="flagged-seller-preview">
                  <div className="flagged-seller-avatar-small">
                    {(() => {
                      const cleanedPic = cleanProfilePicture(selectedSeller.profileData.profilePicture);
                      return cleanedPic ? (
                        <img
                          src={cleanedPic}
                          alt={cleanSellerName(selectedSeller.profileData.name)}
                          className="flagged-seller-img"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '';
                              const placeholder = document.createElement('div');
                              placeholder.className = 'flagged-seller-placeholder';
                              placeholder.style.backgroundColor = getAvatarColor(selectedSeller.profileData.name);
                              placeholder.textContent = getInitials(selectedSeller.profileData.name);
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="flagged-seller-placeholder"
                          style={{ backgroundColor: getAvatarColor(selectedSeller.profileData.name) }}
                        >
                          {getInitials(selectedSeller.profileData.name)}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flagged-seller-details">
                    <strong>{cleanSellerName(selectedSeller.profileData.name)}</strong>
                    <span>{selectedSeller.platform}</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="flag-reason">Reason for Flagging *</label>
                <textarea
                  id="flag-reason"
                  className="form-input form-textarea"
                  placeholder="Please provide a reason for flagging this seller (e.g., suspicious activity, fake listings, etc.)"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  rows={4}
                  disabled={isFlagging}
                />
                <small className="form-hint">Your report helps us keep the marketplace safe for everyone.</small>
              </div>

              {error && (
                <div className="error-message" style={{ marginTop: '12px' }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="verible-btn secondary-btn"
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagReason('');
                  setError('');
                }}
                disabled={isFlagging}
              >
                Cancel
              </button>
              <button
                className="verible-btn primary-btn flag-submit-btn"
                onClick={handleSubmitFlag}
                disabled={isFlagging || !flagReason.trim()}
              >
                {isFlagging ? 'Submitting...' : '🚩 Submit Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Endorse Seller Modal */}
      {showEndorseModal && selectedSeller && (
        <div className="modal-overlay" onClick={() => setShowEndorseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Endorse Seller</h3>
              <button className="modal-close" onClick={() => setShowEndorseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="endorse-seller-info">
                <p>You are about to endorse:</p>
                <div className="endorsed-seller-preview">
                  <div className="endorsed-seller-avatar-small">
                    {(() => {
                      const cleanedPic = cleanProfilePicture(selectedSeller.profileData.profilePicture);
                      return cleanedPic ? (
                        <img
                          src={cleanedPic}
                          alt={cleanSellerName(selectedSeller.profileData.name)}
                          className="endorsed-seller-img"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '';
                              const placeholder = document.createElement('div');
                              placeholder.className = 'endorsed-seller-placeholder';
                              placeholder.style.backgroundColor = getAvatarColor(selectedSeller.profileData.name);
                              placeholder.textContent = getInitials(selectedSeller.profileData.name);
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="endorsed-seller-placeholder"
                          style={{ backgroundColor: getAvatarColor(selectedSeller.profileData.name) }}
                        >
                          {getInitials(selectedSeller.profileData.name)}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="endorsed-seller-details">
                    <strong>{cleanSellerName(selectedSeller.profileData.name)}</strong>
                    <span>{selectedSeller.platform}</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="endorse-reason">Reason for Endorsing *</label>
                <textarea
                  id="endorse-reason"
                  className="form-input form-textarea"
                  placeholder="Please provide a reason for endorsing this seller (e.g., reliable seller, good communication, positive experience, etc.)"
                  value={endorseReason}
                  onChange={(e) => setEndorseReason(e.target.value)}
                  rows={4}
                  disabled={isEndorsing}
                />
                <small className="form-hint">Your endorsement helps build trust in the marketplace community.</small>
              </div>

              {error && (
                <div className="error-message" style={{ marginTop: '12px' }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="verible-btn secondary-btn"
                onClick={() => {
                  setShowEndorseModal(false);
                  setEndorseReason('');
                  setError('');
                }}
                disabled={isEndorsing}
              >
                Cancel
              </button>
              <button
                className="verible-btn primary-btn endorse-submit-btn"
                onClick={handleSubmitEndorse}
                disabled={isEndorsing || !endorseReason.trim()}
              >
                {isEndorsing ? 'Submitting...' : '✅ Submit Endorsement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Message Modal */}
      {showMessageModal && messageModalData && (
        <div className="modal-overlay" onClick={() => {
          setShowMessageModal(false);
          setMessageModalData(null);
        }}>
          <div className="modal-content message-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`message-modal-header ${messageModalData.type}`}>
              <div className="message-modal-icon">
                {messageModalData.type === 'success' ? '✅' : '❌'}
              </div>
              <h3 className="message-modal-title">{messageModalData.title}</h3>
              <button
                className="modal-close message-modal-close"
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageModalData(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body message-modal-body">
              <p className="message-modal-text">{messageModalData.message}</p>
              {messageModalData.details && (
                <div className="message-modal-details">
                  <pre>{messageModalData.details}</pre>
                </div>
              )}
            </div>
            <div className="modal-footer message-modal-footer">
              <button
                className="verible-btn primary-btn"
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageModalData(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settings</h3>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="modal-body">
              {isLoadingSettings ? (
                <div className="loading-container" style={{ padding: '40px', textAlign: 'center' }}>
                  <div className="loading-spinner"></div>
                  <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading user details...</p>
                </div>
              ) : settingsUserData ? (
                <>
                  <div className="settings-section">
                    <h4 className="settings-section-title">User Details</h4>
                    <div className="settings-info-grid">
                      <div className="settings-info-item">
                        <span className="settings-info-label">User ID</span>
                        <span className="settings-info-value">{settingsUserData._id}</span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Email</span>
                        <span className="settings-info-value">{settingsUserData.email}</span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Phone</span>
                        <span className="settings-info-value">{settingsUserData.phone || 'Not provided'}</span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Role</span>
                        <span className="settings-info-value">{settingsUserData.role || 'user'}</span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Verified</span>
                        <span className={`settings-info-value ${settingsUserData.verified ? 'verified' : 'unverified'}`}>
                          {settingsUserData.verified ? '✓ Yes' : '✗ No'}
                        </span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Verification Method</span>
                        <span className="settings-info-value">{settingsUserData.verificationMethod || 'N/A'}</span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Status</span>
                        <span className={`settings-info-value ${settingsUserData.isActive ? 'active' : 'inactive'}`}>
                          {settingsUserData.isActive ? '✓ Active' : '✗ Inactive'}
                        </span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Created At</span>
                        <span className="settings-info-value">
                          {settingsUserData.createdAt
                            ? (() => {
                              const date = new Date(settingsUserData.createdAt);
                              return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
                            })()
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="settings-info-item">
                        <span className="settings-info-label">Last Updated</span>
                        <span className="settings-info-value">
                          {settingsUserData.updatedAt
                            ? (() => {
                              const date = new Date(settingsUserData.updatedAt);
                              return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
                            })()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="settings-section">
                    <h4 className="settings-section-title">Edit Profile</h4>
                    <div className="form-group">
                      <label htmlFor="settings-name" className="form-label">
                        Name
                      </label>
                      <input
                        id="settings-name"
                        type="text"
                        className="form-input"
                        placeholder="Enter your name"
                        value={settingsFormData.name}
                        onChange={(e) => setSettingsFormData({ ...settingsFormData, name: e.target.value })}
                        disabled={isSavingSettings}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state-modern">
                  <div className="empty-icon">⚠️</div>
                  <p>Failed to load user details</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="verible-btn secondary-btn"
                onClick={() => {
                  setShowSettings(false);
                  setSettingsUserData(null);
                  setSettingsFormData({ name: '' });
                }}
                disabled={isSavingSettings}
              >
                Cancel
              </button>
              <button
                className="verible-btn primary-btn"
                onClick={async () => {
                  if (!settingsFormData.name.trim()) {
                    showMessage('error', 'Validation Error', 'Please enter a name');
                    return;
                  }

                  setIsSavingSettings(true);
                  try {
                    const response = await apiService.updateProfile({ name: settingsFormData.name.trim() });

                    if (response.success && response.data) {
                      // Update current user state
                      setCurrentUser(response.data);
                      // Update stored auth data
                      await authService.updateUserData(response.data);
                      // Refresh settings data
                      setSettingsUserData(response.data);
                      setSettingsFormData({ name: response.data.name });
                      showMessage('success', 'Profile Updated', 'Your profile has been updated successfully.');
                    } else {
                      showMessage('error', 'Update Failed', response.error || 'Failed to update profile. Please try again.');
                    }
                  } catch (err: any) {
                    console.error('Error updating profile:', err);
                    showMessage('error', 'Error', 'An error occurred while updating your profile. Please try again.');
                  } finally {
                    setIsSavingSettings(false);
                  }
                }}
                disabled={isSavingSettings || !settingsFormData.name.trim() || settingsFormData.name === settingsUserData?.name}
              >
                {isSavingSettings ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results Modal (for multiple sellers) */}
      {showSearchResults && searchResultsList.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowSearchResults(false)}>
          <div className="modal-content search-results-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Search Results</h3>
              <button className="modal-close" onClick={() => setShowSearchResults(false)}>×</button>
            </div>
            <div className="modal-body">
              {searchResultsPagination && (
                <div className="search-results-summary">
                  <p>Found {searchResultsPagination.totalSellers} seller{searchResultsPagination.totalSellers !== 1 ? 's' : ''} matching your search</p>
                </div>
              )}
              <div className="search-results-list">
                {searchResultsList.map((seller) => (
                  <div key={seller._id} className="search-result-item" onClick={async () => {
                    // Close search results modal
                    setShowSearchResults(false);

                    // Fetch full seller details
                    setIsLoadingSellerDetail(true);
                    setShowSellerDetail(true);
                    setSelectedSeller(seller);
                    setSellerDetailData(null);

                    try {
                      const detailResponse = await apiService.getSellerById(seller._id);

                      if (detailResponse.success && detailResponse.data) {
                        setSelectedSeller(detailResponse.data.seller);
                        setSellerDetailData({
                          seller: detailResponse.data.seller,
                          scoringResult: detailResponse.data.scoringResult,
                        });
                      } else {
                        // Fallback: use the seller data from search without scoring result
                        setSelectedSeller(seller);
                        setSellerDetailData({
                          seller: seller,
                          scoringResult: undefined,
                        });
                      }
                    } catch (err) {
                      // Fallback: use the seller data from search without scoring result
                      setSelectedSeller(seller);
                      setSellerDetailData({
                        seller: seller,
                        scoringResult: undefined,
                      });
                    } finally {
                      setIsLoadingSellerDetail(false);
                    }
                  }}>
                    <div className="search-result-avatar">
                      {(() => {
                        const cleanedPic = cleanProfilePicture(seller.profileData.profilePicture);
                        return cleanedPic ? (
                          <img
                            src={cleanedPic}
                            alt={cleanSellerName(seller.profileData.name)}
                            className="search-result-avatar-img"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '';
                                const placeholder = document.createElement('div');
                                placeholder.className = 'search-result-avatar-placeholder';
                                placeholder.style.backgroundColor = getAvatarColor(seller.profileData.name);
                                placeholder.textContent = getInitials(seller.profileData.name);
                                parent.appendChild(placeholder);
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="search-result-avatar-placeholder"
                            style={{ backgroundColor: getAvatarColor(seller.profileData.name) }}
                          >
                            {getInitials(seller.profileData.name)}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-name">{cleanSellerName(seller.profileData.name)}</div>
                      <div className="search-result-meta">
                        {getPlatformIcon(seller.platform)} {seller.platform}
                        {seller.profileData.location && ` • ${seller.profileData.location}`}
                      </div>
                      <div className="search-result-score">
                        <span className={`pulse-score-badge ${getPulseScoreClass(seller.pulseScore)}`}>
                          {seller.pulseScore}/100
                        </span>
                        <span className={`confidence-badge-small ${getConfidenceClass(seller.confidenceLevel)}`}>
                          {seller.confidenceLevel}
                        </span>
                      </div>
                    </div>
                    <div className="search-result-arrow">→</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="verible-btn primary-btn" onClick={() => setShowSearchResults(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirmation Modal */}
      {showConfirmModal && confirmModalData && (
        <div className="modal-overlay" onClick={() => {
          if (confirmModalData.onCancel) {
            confirmModalData.onCancel();
          }
          setShowConfirmModal(false);
          setConfirmModalData(null);
        }}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header confirm-modal-header">
              <h3 className="confirm-modal-title">{confirmModalData.title}</h3>
              <button
                className="modal-close confirm-modal-close"
                onClick={() => {
                  if (confirmModalData.onCancel) {
                    confirmModalData.onCancel();
                  }
                  setShowConfirmModal(false);
                  setConfirmModalData(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body confirm-modal-body">
              <p className="confirm-modal-message">{confirmModalData.message}</p>
            </div>
            <div className="modal-footer confirm-modal-footer">
              <button
                className="verible-btn secondary-btn confirm-cancel-btn"
                onClick={() => {
                  if (confirmModalData.onCancel) {
                    confirmModalData.onCancel();
                  }
                  setShowConfirmModal(false);
                  setConfirmModalData(null);
                }}
              >
                {confirmModalData.cancelText || 'Cancel'}
              </button>
              <button
                className="verible-btn primary-btn confirm-submit-btn"
                onClick={() => {
                  confirmModalData.onConfirm();
                }}
              >
                {confirmModalData.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}