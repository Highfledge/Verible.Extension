import React, { useState } from 'react';
import { apiService } from '../../services/api';
import Logo from '../Logo';
import './AuthForm.css';

interface SignUpProps {
  onSwitchToSignIn: () => void;
  onEmailVerificationNeeded: (email: string) => void;
}

export default function SignUp({ onSwitchToSignIn, onEmailVerificationNeeded }: SignUpProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 2) return '#ef4444'; // Red
    if (strength < 4) return '#f59e0b'; // Yellow
    return '#10b981'; // Green
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 2) return 'Weak';
    if (strength < 4) return 'Medium';
    return 'Strong';
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (formData.name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return false;
    }
    if (!formData.email) {
      setError('Email is required');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.phone) {
      setError('Phone number is required');
      return false;
    }
    // Basic phone validation - should start with + and have at least 10 digits
    if (!/^\+[1-9]\d{9,14}$/.test(formData.phone)) {
      setError('Please enter a valid phone number (e.g., +1234567890)');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (calculatePasswordStrength(formData.password) < 3) {
      setError('Password is too weak. Please include uppercase, lowercase, and numbers');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
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
      const response = await apiService.register({
        name: formData.name.trim(),
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: 'user',
        verificationMethod: 'email',
      });
      
      if (response.success) {
        // Registration successful, navigate to email verification screen
        // Pass the email to the verification component
        onEmailVerificationNeeded(formData.email);
      } else {
        setError(response.error || 'Registration failed. Please try again.');
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  return (
    <div className="auth-container">
      <div className="auth-header">
        <Logo size="medium" showText={true} />
        <p className="auth-subtitle">Create your account</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter your full name"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your email"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="+1234567890"
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
              placeholder="Create a password"
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
          {formData.password && (
            <div className="password-strength">
              <div className="strength-bar">
                <div 
                  className="strength-fill"
                  style={{
                    width: `${(passwordStrength / 5) * 100}%`,
                    backgroundColor: getPasswordStrengthColor(passwordStrength)
                  }}
                />
              </div>
              <span 
                className="strength-text"
                style={{ color: getPasswordStrengthColor(passwordStrength) }}
              >
                {getPasswordStrengthText(passwordStrength)}
              </span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-input">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <div className="error-text">Passwords do not match</div>
          )}
        </div>

        <button
          type="submit"
          className="verible-btn primary-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Already have an account?{' '}
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
