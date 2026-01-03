import React, { useState, useEffect } from 'react';
import './App.css';
import { authService, type AuthState } from './services/authService';
import Logo from './components/Logo';

// Authentication screens
import SignIn from './components/auth/SignIn';
import SignUp from './components/auth/SignUp';
import ForgotPassword from './components/auth/ForgotPassword';
import EmailVerification from './components/auth/EmailVerification';
import Dashboard from './components/Dashboard';

type AuthScreen = 'signin' | 'signup' | 'forgot-password' | 'email-verification' | 'dashboard';

function App() {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('signin');
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true,
    error: null
  });
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [pendingSellerAnalysis, setPendingSellerAnalysis] = useState<any>(null);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
    checkPendingSellerAnalysis();
  }, []);

  // Check for pending seller analysis from badge click
  const checkPendingSellerAnalysis = async () => {
    try {
      // Get browser storage API
      const browser = (window as any).chrome || (window as any).browser;
      if (!browser?.storage) return;

      const result = await browser.storage.local.get(['activeSellerContext', 'activeSellerUpdatedAt']);
      
      if (result.activeSellerContext && result.activeSellerUpdatedAt) {
        setPendingSellerAnalysis(result.activeSellerContext);
        
        // Clear the flag
        await browser.storage.local.remove(['openSellerAnalysis']);
      }
    } catch (error) {
      console.error('Error checking pending seller analysis:', error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      console.log('Checking authentication status...');
      const authState = await authService.getAuthState();
      
      console.log('Auth state:', authState);
      setAuthState(authState);
      
      if (authState.isAuthenticated) {
        setCurrentScreen('dashboard');
        console.log('User is authenticated, redirecting to dashboard');
      } else {
        setCurrentScreen('signin');
        console.log('User not authenticated, showing sign in');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setCurrentScreen('signin');
    }
  };

  const handleAuthSuccess = async (userData: any, token: string) => {
    console.log('handleAuthSuccess called with:', { userData, token });
    
    try {
      // Calculate token expiration (assuming 24 hours from now)
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
      
      // Store auth data securely
      const authData = {
        user: userData,
        token,
        expiresAt,
        refreshToken: undefined // Add refresh token if available
      };
      
      console.log('Storing auth data:', authData);
      const stored = await authService.storeAuthData(authData);
      console.log('Auth data stored result:', stored);
      
      if (stored) {
        console.log('Auth data stored securely');
        const newAuthState = {
          isAuthenticated: true,
          user: userData,
          token,
          isLoading: false,
          error: null
        };
        console.log('Setting auth state:', newAuthState);
        setAuthState(newAuthState);
        console.log('Setting current screen to dashboard');
        setCurrentScreen('dashboard');
        console.log('Auth success - redirected to dashboard');
      } else {
        console.error('Failed to store auth data');
        setAuthState(prev => ({
          ...prev,
          error: 'Failed to save authentication data'
        }));
      }
    } catch (error) {
      console.error('Error in handleAuthSuccess:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out user...');
      
      // Clear all auth data securely
      const cleared = await authService.clearAuthData();
      
      if (cleared) {
        console.log('Auth data cleared successfully');
      } else {
        console.warn('Failed to clear some auth data');
      }
      
      // Reset state
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: null
      });
      setCurrentScreen('signin');
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      // Still reset state even if clearing failed
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: null
      });
      setCurrentScreen('signin');
    }
  };

  const renderScreen = () => {
    console.log('Rendering screen:', currentScreen, 'Auth state:', authState);
    switch (currentScreen) {
      case 'signin':
        return (
          <SignIn 
            onSwitchToSignUp={() => setCurrentScreen('signup')}
            onSwitchToForgotPassword={() => setCurrentScreen('forgot-password')}
            onAuthSuccess={handleAuthSuccess}
            onVerificationNeeded={(emailOrPhone) => {
              setPendingVerificationEmail(emailOrPhone);
              setCurrentScreen('email-verification');
            }}
          />
        );
      case 'signup':
        return (
          <SignUp 
            onSwitchToSignIn={() => setCurrentScreen('signin')}
            onEmailVerificationNeeded={(email) => {
              setPendingVerificationEmail(email);
              setCurrentScreen('email-verification');
            }}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPassword 
            onSwitchToSignIn={() => setCurrentScreen('signin')}
            onPasswordResetSent={() => setCurrentScreen('signin')}
          />
        );
      case 'email-verification':
        return (
          <EmailVerification 
            email={pendingVerificationEmail}
            onSwitchToSignIn={() => setCurrentScreen('signin')}
            onVerificationComplete={handleAuthSuccess}
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            user={authState.user}
            onLogout={handleLogout}
            pendingSellerAnalysis={pendingSellerAnalysis}
            onPendingSellerAnalysisHandled={() => {
              setPendingSellerAnalysis(null);
              // Clear from storage
              const browser = (window as any).chrome || (window as any).browser;
              if (browser?.storage) {
                browser.storage.local.remove(['activeSellerContext', 'activeSellerUpdatedAt']);
              }
            }}
          />
        );
      default:
        return (
          <SignIn 
            onSwitchToSignUp={() => setCurrentScreen('signup')}
            onSwitchToForgotPassword={() => setCurrentScreen('forgot-password')}
            onAuthSuccess={handleAuthSuccess}
            onVerificationNeeded={(emailOrPhone) => {
              setPendingVerificationEmail(emailOrPhone);
              setCurrentScreen('email-verification');
            }}
          />
        );
    }
  };

  // Show loading state while checking authentication
  if (authState.isLoading) {
    return (
      <div className="verible-app">
        <div className="loading-container">
          <Logo size="large" showText={true} />
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verible-app">
      {renderScreen()}
    </div>
  );
}

export default App;
