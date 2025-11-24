import React, { useState } from 'react';
import { apiService } from '../../services/api';
import Logo from '../Logo';
import './AuthForm.css';

// Declare browser and chrome APIs
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

interface EmailVerificationProps {
  email: string;
  onSwitchToSignIn: () => void;
  onVerificationComplete: (user: any, token: string) => void;
}

export default function EmailVerification({ email, onSwitchToSignIn, onVerificationComplete }: EmailVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6); // Only numbers, max 6 digits
    setVerificationCode(value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateCode = () => {
    if (!verificationCode) {
      setError('Verification code is required');
      return false;
    }
    if (verificationCode.length < 6) {
      setError('Verification code must be 6 digits');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCode()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await apiService.verifyEmail(verificationCode, email);
      
      if (response.success && response.data) {
        setSuccess('Account verified successfully! You can now login.');
        // Do NOT store the token from verification
        // Navigate to Sign In screen after 2 seconds
        setTimeout(() => {
          onSwitchToSignIn();
        }, 2000);
      } else {
        setError(response.error || 'Invalid verification code. Please try again.');
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Email verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError('Email address is required to resend verification code');
      return;
    }

    setIsResending(true);
    setError('');

    try {
      const response = await apiService.resendOTP(email, 'email');
      
      if (response.success) {
        // Show success message with verification code for development
        console.log('Resend OTP response:', response);
        const code = response.data?.verificationCode || '';
        setSuccess(`Verification code sent! Code: ${code}`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(response.error || 'Failed to resend verification code. Please try again.');
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Resend OTP error:', error);
    } finally {
      setIsResending(false);
    }
  };

  if (success && success.includes('verified')) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <Logo size="medium" showText={true} />
        </div>

        <div className="success-message">
          <div className="success-icon">✅</div>
          <h3>Email Verified!</h3>
          <p>Your email has been successfully verified.</p>
          <p className="redirect-note">
            Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-header">
        <Logo size="medium" showText={true} />
        <p className="auth-subtitle">Verify your email</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message-inline">
            {success}
          </div>
        )}

        <div className="verification-info">
          <p>
            We've sent a 6-digit verification code to your email address.
            {email && <><br /><strong>{email}</strong></>}
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="verificationCode">Verification Code</label>
          <input
            type="text"
            id="verificationCode"
            name="verificationCode"
            value={verificationCode}
            onChange={handleInputChange}
            placeholder="Enter 6-digit code"
            maxLength={6}
            required
            disabled={isLoading}
            className="verification-code-input"
          />
        </div>

        <button
          type="submit"
          className="verible-btn primary-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>

        <div className="resend-section">
          <p>Didn't receive the code?</p>
          <button
            type="button"
            className="resend-link"
            onClick={handleResendCode}
            disabled={isResending || isLoading}
          >
            {isResending ? 'Sending...' : 'Resend Code'}
          </button>
        </div>
      </form>

      <div className="auth-footer">
        <p>
          Wrong email?{' '}
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToSignIn}
            disabled={isLoading}
          >
            Go back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}
