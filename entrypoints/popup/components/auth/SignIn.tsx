import React, { useState } from 'react';
import { apiService } from '../../services/api';
import Logo from '../Logo';
import './AuthForm.css';

interface SignInProps {
  onSwitchToSignUp: () => void;
  onSwitchToForgotPassword: () => void;
  onAuthSuccess: (user: any, token: string) => void;
  onVerificationNeeded: (emailOrPhone: string) => void;
}

export default function SignIn({ onSwitchToSignUp, onSwitchToForgotPassword, onAuthSuccess, onVerificationNeeded }: SignInProps) {
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.emailOrPhone) {
      setError('Email or phone is required');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      console.log('Attempting login with:', formData);
      const response = await apiService.login(formData);
      console.log('Login response:', response);
      
      if (response.success && response.data) {
        console.log('Login successful, calling onAuthSuccess with:', response.data.user, response.data.token);
        console.log('About to call onAuthSuccess...');
        await onAuthSuccess(response.data.user, response.data.token);
        console.log('onAuthSuccess completed');
      } else {
        console.log('Login failed:', response.error, response.message);
        
        // Check if the error is due to unverified account
        if (response.message === 'Please verify your account') {
          // Automatically resend verification code
          try {
            const resendResponse = await apiService.resendOTP(formData.emailOrPhone, 'email');
            if (resendResponse.success) {
              // Route to verification screen
              onVerificationNeeded(formData.emailOrPhone);
            } else {
              setError('Please verify your account. Failed to resend verification code.');
            }
          } catch (resendError) {
            console.error('Resend code error:', resendError);
            setError('Please verify your account. Failed to resend verification code.');
          }
        } else {
          setError(response.error || response.message || 'Login failed. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <Logo size="medium" showText={true} />
        <p className="auth-subtitle">Sign in to your account</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="emailOrPhone">Email or Phone</label>
          <input
            type="text"
            id="emailOrPhone"
            name="emailOrPhone"
            value={formData.emailOrPhone}
            onChange={handleInputChange}
            placeholder="Enter your email or phone"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="forgot-password-link"
          onClick={onSwitchToForgotPassword}
          disabled={isLoading}
        >
          Forgot your password?
        </button>

        <button
          type="submit"
          className="verible-btn primary-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Don't have an account?{' '}
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToSignUp}
            disabled={isLoading}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
