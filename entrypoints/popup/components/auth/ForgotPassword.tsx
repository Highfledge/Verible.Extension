import React, { useState } from 'react';
import { apiService } from '../../services/api';
import Logo from '../Logo';
import './AuthForm.css';

interface ForgotPasswordProps {
  onSwitchToSignIn: () => void;
  onPasswordResetSent: () => void;
}

export default function ForgotPassword({ onSwitchToSignIn, onPasswordResetSent }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateEmail = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await apiService.requestPasswordReset(email);
      
      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onPasswordResetSent();
        }, 3000);
      } else {
        setError(response.error || 'Failed to send reset email. Please try again.');
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <Logo size="medium" showText={true} />
        </div>

        <div className="success-message">
          <div className="success-icon">✅</div>
          <h3>Check your email</h3>
          <p>
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="success-note">
            Please check your inbox and follow the instructions to reset your password.
          </p>
          <p className="redirect-note">
            Redirecting to sign in page in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-header">
        <Logo size="medium" showText={true} />
        <p className="auth-subtitle">Reset your password</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={handleInputChange}
            placeholder="Enter your email address"
            required
            disabled={isLoading}
          />
        </div>

        <div className="forgot-password-info">
          <p>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <button
          type="submit"
          className="verible-btn primary-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Remember your password?{' '}
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToSignIn}
            disabled={isLoading}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
