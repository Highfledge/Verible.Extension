// Secure Authentication Service for Verible Extension
declare const browser: any;
declare const chrome: any;

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

export interface AuthData {
  user: User;
  token: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

// Simple encryption/decryption for token storage (basic obfuscation)
class TokenEncryption {
  private static readonly KEY = 'verible_secure_key_2024';
  
  static encrypt(text: string): string {
    try {
      // Simple XOR encryption for basic obfuscation
      let encrypted = '';
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ this.KEY.charCodeAt(i % this.KEY.length);
        encrypted += String.fromCharCode(charCode);
      }
      return btoa(encrypted); // Base64 encode
    } catch (error) {
      console.error('Encryption failed:', error);
      return text; // Fallback to plain text
    }
  }
  
  static decrypt(encryptedText: string): string {
    try {
      const decoded = atob(encryptedText); // Base64 decode
      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ this.KEY.charCodeAt(i % this.KEY.length);
        decrypted += String.fromCharCode(charCode);
      }
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedText; // Fallback to encrypted text
    }
  }
}

class AuthService {
  private static readonly STORAGE_KEYS = {
    AUTH_DATA: 'verible_auth_data',
    USER_PREFERENCES: 'verible_user_preferences'
  };

  // Store authentication data securely
  async storeAuthData(authData: AuthData): Promise<boolean> {
    try {
      const storage = getStorageAPI();
      if (!storage) {
        console.warn('Storage API not available, trying alternative storage...');
        
        // Try using localStorage as fallback
        try {
          const encryptedAuthData = {
            ...authData,
            token: TokenEncryption.encrypt(authData.token),
            refreshToken: authData.refreshToken ? TokenEncryption.encrypt(authData.refreshToken) : undefined
          };
          
          localStorage.setItem(AuthService.STORAGE_KEYS.AUTH_DATA, JSON.stringify(encryptedAuthData));
          console.log('Auth data stored in localStorage as fallback');
          return true;
        } catch (localStorageError) {
          console.error('localStorage also failed:', localStorageError);
          return false;
        }
      }

      // Encrypt sensitive data
      const encryptedAuthData = {
        ...authData,
        token: TokenEncryption.encrypt(authData.token),
        refreshToken: authData.refreshToken ? TokenEncryption.encrypt(authData.refreshToken) : undefined
      };

      await storage.local.set({
        [AuthService.STORAGE_KEYS.AUTH_DATA]: encryptedAuthData
      });

      console.log('Auth data stored securely');
      return true;
    } catch (error) {
      console.error('Failed to store auth data:', error);
      return false;
    }
  }

  // Retrieve and decrypt authentication data
  async getAuthData(): Promise<AuthData | null> {
    try {
      const storage = getStorageAPI();
      if (!storage) {
        console.warn('Storage API not available, trying localStorage...');
        
        // Try localStorage as fallback
        try {
          const storedData = localStorage.getItem(AuthService.STORAGE_KEYS.AUTH_DATA);
          if (!storedData) {
            return null;
          }
          
          const encryptedAuthData = JSON.parse(storedData);
          
          // Decrypt sensitive data
          const authData: AuthData = {
            ...encryptedAuthData,
            token: TokenEncryption.decrypt(encryptedAuthData.token),
            refreshToken: encryptedAuthData.refreshToken ? 
              TokenEncryption.decrypt(encryptedAuthData.refreshToken) : undefined
          };
          
          return authData;
        } catch (localStorageError) {
          console.error('localStorage also failed:', localStorageError);
          return null;
        }
      }

      const result = await storage.local.get([AuthService.STORAGE_KEYS.AUTH_DATA]);
      const encryptedAuthData = result[AuthService.STORAGE_KEYS.AUTH_DATA];

      if (!encryptedAuthData) {
        return null;
      }

      // Decrypt sensitive data
      const authData: AuthData = {
        ...encryptedAuthData,
        token: TokenEncryption.decrypt(encryptedAuthData.token),
        refreshToken: encryptedAuthData.refreshToken ? 
          TokenEncryption.decrypt(encryptedAuthData.refreshToken) : undefined
      };

      return authData;
    } catch (error) {
      console.error('Failed to retrieve auth data:', error);
      return null;
    }
  }

  // Check if token is valid and not expired
  isTokenValid(authData: AuthData): boolean {
    if (!authData || !authData.token || !authData.expiresAt) {
      return false;
    }

    const now = Date.now();
    const expiresAt = authData.expiresAt;
    
    // Add 5 minute buffer before actual expiration
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return now < (expiresAt - bufferTime);
  }

  // Validate token with server
  async validateToken(token: string): Promise<{ valid: boolean; user?: User; error?: string }> {
    try {
      const response = await fetch('https://verible-backend-gamma.vercel.app/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          valid: true,
          user: data.data || data.user
        };
      } else {
        return {
          valid: false,
          error: `Token validation failed: ${response.status}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Refresh token if available
  async refreshToken(refreshToken: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      const response = await fetch('https://verible-backend-gamma.vercel.app/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          token: data.token || data.data?.token,
          user: data.user || data.data?.user
        };
      } else {
        return {
          success: false,
          error: `Token refresh failed: ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Attempt to refresh token and update stored auth data
  async attemptTokenRefresh(): Promise<boolean> {
    try {
      const authData = await this.getAuthData();
      if (!authData || !authData.refreshToken) {
        return false;
      }

      console.log('Attempting to refresh token...');
      const refreshResult = await this.refreshToken(authData.refreshToken);
      
      if (refreshResult.success && refreshResult.token) {
        console.log('Token refreshed successfully');
        
        // Update stored auth data with new token
        const updatedAuthData = {
          ...authData,
          token: refreshResult.token,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
          user: refreshResult.user || authData.user
        };
        
        await this.storeAuthData(updatedAuthData);
        return true;
      } else {
        console.log('Token refresh failed:', refreshResult.error);
        return false;
      }
    } catch (error) {
      console.error('Error during token refresh:', error);
      return false;
    }
  }

  // Get current authentication state
  async getAuthState(): Promise<AuthState> {
    try {
      const authData = await this.getAuthData();
      
      if (!authData) {
        return {
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false,
          error: null
        };
      }

      // Check if token is still valid locally
      if (!this.isTokenValid(authData)) {
        console.log('Token expired locally, attempting refresh...');
        
        // Try to refresh token if available
        const refreshSuccess = await this.attemptTokenRefresh();
        
        if (refreshSuccess) {
          // Get updated auth data after refresh
          const updatedAuthData = await this.getAuthData();
          if (updatedAuthData && this.isTokenValid(updatedAuthData)) {
            return {
              isAuthenticated: true,
              user: updatedAuthData.user,
              token: updatedAuthData.token,
              isLoading: false,
              error: null
            };
          }
        }
        
        // If refresh failed or no refresh token, clear auth data
        console.log('Token refresh failed, clearing auth data');
        await this.clearAuthData();
        return {
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false,
          error: 'Token expired and refresh failed'
        };
      }

      // Validate token with server
      const validation = await this.validateToken(authData.token);
      
      if (!validation.valid) {
        console.log('Token invalid on server, attempting refresh...');
        
        // Try to refresh token if available
        const refreshSuccess = await this.attemptTokenRefresh();
        
        if (refreshSuccess) {
          // Get updated auth data after refresh
          const updatedAuthData = await this.getAuthData();
          if (updatedAuthData && this.isTokenValid(updatedAuthData)) {
            return {
              isAuthenticated: true,
              user: updatedAuthData.user,
              token: updatedAuthData.token,
              isLoading: false,
              error: null
            };
          }
        }
        
        // If refresh failed, clear auth data
        console.log('Token validation failed and refresh failed, clearing auth data');
        await this.clearAuthData();
        return {
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false,
          error: validation.error || 'Token validation failed'
        };
      }

      return {
        isAuthenticated: true,
        user: validation.user || authData.user,
        token: authData.token,
        isLoading: false,
        error: null
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Clear all authentication data
  async clearAuthData(): Promise<boolean> {
    try {
      const storage = getStorageAPI();
      if (!storage) {
        console.warn('Storage API not available, clearing localStorage...');
        
        // Clear localStorage as fallback
        try {
          localStorage.removeItem(AuthService.STORAGE_KEYS.AUTH_DATA);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          console.log('Auth data cleared from localStorage');
          return true;
        } catch (localStorageError) {
          console.error('localStorage clear also failed:', localStorageError);
          return false;
        }
      }

      await storage.local.remove([
        AuthService.STORAGE_KEYS.AUTH_DATA,
        'authToken', // Legacy key
        'user' // Legacy key
      ]);

      // Also clear localStorage as backup
      try {
        localStorage.removeItem(AuthService.STORAGE_KEYS.AUTH_DATA);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      } catch (error) {
        console.warn('Could not clear localStorage:', error);
      }

      // Notify background script
      const runtime = getRuntimeAPI();
      if (runtime) {
        try {
          runtime.sendMessage({ type: 'AUTH_TOKEN_EXPIRED' });
        } catch (error) {
          console.warn('Could not notify background script:', error);
        }
      }

      console.log('Auth data cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear auth data:', error);
      return false;
    }
  }

  // Update user data
  async updateUserData(user: User): Promise<boolean> {
    try {
      const authData = await this.getAuthData();
      if (!authData) {
        return false;
      }

      const updatedAuthData = {
        ...authData,
        user
      };

      return await this.storeAuthData(updatedAuthData);
    } catch (error) {
      console.error('Failed to update user data:', error);
      return false;
    }
  }

  // Set user preferences
  async setUserPreferences(preferences: Record<string, any>): Promise<boolean> {
    try {
      const storage = getStorageAPI();
      if (!storage) {
        return false;
      }

      await storage.local.set({
        [AuthService.STORAGE_KEYS.USER_PREFERENCES]: preferences
      });

      return true;
    } catch (error) {
      console.error('Failed to set user preferences:', error);
      return false;
    }
  }

  // Get user preferences
  async getUserPreferences(): Promise<Record<string, any> | null> {
    try {
      const storage = getStorageAPI();
      if (!storage) {
        return null;
      }

      const result = await storage.local.get([AuthService.STORAGE_KEYS.USER_PREFERENCES]);
      return result[AuthService.STORAGE_KEYS.USER_PREFERENCES] || null;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export types
export type { AuthData, AuthState, User };
