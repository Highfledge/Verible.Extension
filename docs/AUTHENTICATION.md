# Authentication System Documentation

## Overview

The Verible extension now includes a secure, persistent authentication system that allows users to stay logged in across browser sessions. The system includes token encryption, automatic validation, and refresh mechanisms.

## Key Features

### 🔐 Secure Token Storage
- **Encryption**: Tokens are encrypted before storage using XOR encryption
- **Browser Storage**: Uses browser's secure storage API
- **Automatic Cleanup**: Expired tokens are automatically removed

### 🔄 Automatic Token Management
- **Validation**: Tokens are validated with the server on app startup
- **Refresh**: Automatic token refresh when available
- **Expiration Handling**: Graceful handling of expired tokens

### 🛡️ Security Features
- **Token Encryption**: Sensitive data is encrypted before storage
- **Secure Storage**: Uses browser's local storage with encryption
- **Automatic Logout**: Clears data on token expiration
- **Error Handling**: Comprehensive error handling and logging

## Usage

### Basic Authentication Flow

```typescript
import { authService } from './services/authService';

// Check if user is authenticated
const authState = await authService.getAuthState();
if (authState.isAuthenticated) {
  console.log('User is logged in:', authState.user);
} else {
  console.log('User needs to log in');
}
```

### Storing Authentication Data

```typescript
// After successful login
const authData = {
  user: userData,
  token: jwtToken,
  expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  refreshToken: refreshToken // Optional
};

await authService.storeAuthData(authData);
```

### Clearing Authentication Data

```typescript
// On logout
await authService.clearAuthData();
```

### Updating User Data

```typescript
// After profile update
await authService.updateUserData(updatedUser);
```

## API Reference

### AuthService Methods

#### `getAuthState(): Promise<AuthState>`
Returns the current authentication state with automatic token validation and refresh.

**Returns:**
```typescript
{
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}
```

#### `storeAuthData(authData: AuthData): Promise<boolean>`
Securely stores authentication data with encryption.

**Parameters:**
- `authData`: Authentication data including user, token, and expiration

#### `getAuthData(): Promise<AuthData | null>`
Retrieves and decrypts stored authentication data.

#### `clearAuthData(): Promise<boolean>`
Clears all stored authentication data.

#### `updateUserData(user: User): Promise<boolean>`
Updates stored user data.

#### `setUserPreferences(preferences: Record<string, any>): Promise<boolean>`
Stores user preferences.

#### `getUserPreferences(): Promise<Record<string, any> | null>`
Retrieves user preferences.

### Token Management

#### `isTokenValid(authData: AuthData): boolean`
Checks if a token is valid and not expired.

#### `validateToken(token: string): Promise<{valid: boolean, user?: User, error?: string}>`
Validates a token with the server.

#### `refreshToken(refreshToken: string): Promise<{success: boolean, token?: string, user?: User, error?: string}>`
Refreshes an expired token.

#### `attemptTokenRefresh(): Promise<boolean>`
Attempts to refresh the current token if available.

## Integration with App.tsx

The main App component now uses the authentication service:

```typescript
// Check authentication on app load
useEffect(() => {
  checkAuthStatus();
}, []);

const checkAuthStatus = async () => {
  const authState = await authService.getAuthState();
  setAuthState(authState);
  
  if (authState.isAuthenticated) {
    setCurrentScreen('dashboard');
  } else {
    setCurrentScreen('signin');
  }
};
```

## Security Considerations

### Token Encryption
- Tokens are encrypted using XOR encryption with a static key
- Base64 encoding is applied for additional obfuscation
- This provides basic protection against casual inspection

### Storage Security
- Uses browser's secure storage API
- Automatic cleanup of expired tokens
- No sensitive data in plain text

### Network Security
- All API calls use HTTPS
- Tokens are sent in Authorization headers
- Automatic token refresh on expiration

## Error Handling

The system includes comprehensive error handling:

- **Network Errors**: Graceful handling of network failures
- **Token Expiration**: Automatic cleanup and re-authentication
- **Storage Errors**: Fallback behavior when storage is unavailable
- **Validation Errors**: Clear error messages for debugging

## Testing

Use the included test utilities:

```typescript
import testAuthService from './services/authTest';

// Run all tests
await testAuthService.runAllTests();

// Run individual tests
await testAuthService.testStoreAndRetrieve();
await testAuthService.testTokenValidation();
await testAuthService.testAuthState();
await testAuthService.testClearAuthData();
```

## Migration from Legacy System

The new authentication service is backward compatible with the existing API service. The legacy storage keys (`authToken`, `user`) are automatically cleaned up when using the new system.

## Best Practices

1. **Always check authentication state on app startup**
2. **Handle loading states during authentication checks**
3. **Provide clear error messages to users**
4. **Test authentication flows thoroughly**
5. **Monitor token expiration and refresh**

## Troubleshooting

### Common Issues

**User not staying logged in:**
- Check if token expiration is set correctly
- Verify storage API is available
- Check for encryption/decryption errors

**Token validation failures:**
- Verify API endpoint is accessible
- Check network connectivity
- Review server response format

**Storage errors:**
- Check browser storage permissions
- Verify storage quota is not exceeded
- Test in different browsers

### Debug Mode

Enable debug logging by checking the browser console for detailed authentication flow information.
