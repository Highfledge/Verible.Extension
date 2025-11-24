import React from 'react';
import './Logo.css';

// Declare browser API for getting extension URL
declare const browser: any;
declare const chrome: any;

// Helper to get extension URL for images
function getExtensionUrl(path: string): string {
  try {
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime.getURL(path);
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime.getURL(path);
    }
  } catch (error) {
    console.warn('Could not get extension URL:', error);
  }
  // Fallback to relative path
  return path;
}

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 'medium', showText = true, className = '' }: LogoProps) {
  const iconSize = size === 'small' ? 32 : size === 'medium' ? 64 : 128;
  const iconPath = getExtensionUrl(`/icon/${iconSize}.png`);
  const logoSvgPath = getExtensionUrl('/logo/logo.svg');
  const logoPngPath = getExtensionUrl('/logo/logo.png'); // Use logo.png as fallback

  return (
    <div className={`logo-container ${className}`}>
      <div className="logo-icon-wrapper" style={{ width: iconSize, height: iconSize }}>
        {/* Try SVG first, then PNG logo, then fallback to icon */}
        <img 
          src={logoSvgPath}
          alt="Verible Logo"
          className="logo-image"
          style={{ width: iconSize, height: iconSize }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // Try PNG logo
            if (!target.src.includes('.png')) {
              target.src = logoPngPath;
            } else if (!target.src.includes('icon')) {
              // Fallback to extension icon
              target.src = iconPath;
            } else {
              // Show placeholder if all fails
              target.style.display = 'none';
              const placeholder = document.createElement('div');
              placeholder.className = 'logo-placeholder';
              placeholder.style.cssText = `
                width: ${iconSize}px;
                height: ${iconSize}px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 8px;
                color: white;
                font-weight: bold;
                font-size: ${iconSize * 0.6}px;
              `;
              placeholder.textContent = 'V';
              target.parentElement?.appendChild(placeholder);
            }
          }}
        />
      </div>
      {showText && <h1 className="logo-text">Verible</h1>}
    </div>
  );
}

// Simple logo icon component (just the icon, no text)
export function LogoIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  const iconSize = size <= 16 ? 16 : size <= 32 ? 32 : size <= 48 ? 48 : 64;
  const logoSvgPath = getExtensionUrl('/logo/logo.svg');
  const logoPngPath = getExtensionUrl('/logo/logo.png'); // Use logo.png as fallback
  const iconPath = getExtensionUrl(`/icon/${iconSize}.png`);

  return (
    <img 
      src={logoSvgPath}
      alt="Verible"
      className={`logo-icon ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        // Try PNG logo
        if (!target.src.includes('.png')) {
          target.src = logoPngPath;
        } else if (!target.src.includes('icon')) {
          // Fallback to extension icon
          target.src = iconPath;
        } else {
          // Show placeholder if all fails
          target.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = 'logo-placeholder';
          placeholder.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 6px;
            color: white;
            font-weight: bold;
            font-size: ${size * 0.6}px;
          `;
          placeholder.textContent = 'V';
          target.parentElement?.appendChild(placeholder);
        }
      }}
    />
  );
}
