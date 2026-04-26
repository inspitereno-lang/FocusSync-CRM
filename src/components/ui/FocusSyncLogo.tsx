import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  color?: string; // Dynamic color support
  theme?: 'light' | 'dark';
}

export const FocusSyncLogo: React.FC<LogoProps> = ({ 
  size = 40, 
  className = "", 
  showText = false,
  color = '#60a5fa', // Default to blue
  theme = 'dark'
}) => {
  const textColor = theme === 'dark' ? '#f8fafc' : '#0f172a';

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`} style={{ height: 'auto' }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow effect */}
        <div 
          className="absolute inset-0 rounded-full blur-xl opacity-30 animate-pulse" 
          style={{ background: color }}
        />
        
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          {/* Glassy Background Circle */}
          <circle cx="50" cy="50" r="45" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          
          {/* Main Icon Shape (Abstract 'F' + 'S' focus) */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.8" />
            </linearGradient>
            
            <filter id="glassBlur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>

          {/* Liquid Orb (Sync) */}
          <path
            d="M50 15C30.67 15 15 30.67 15 50C15 69.33 30.67 85 50 85C69.33 85 85 69.33 85 50"
            stroke="url(#logoGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            className="opacity-90"
          />
          
          {/* Focused Core */}
          <rect x="42" y="30" width="16" height="40" rx="8" fill="url(#logoGradient)" />
          <rect x="42" y="45" width="25" height="8" rx="4" fill="white" />
          
          {/* Dynamic Sync Dot */}
          <circle cx="50" cy="50" r="4" fill="white">
            <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      
      {showText && (
        <span 
          className="font-black tracking-tighter" 
          style={{ 
            fontSize: size * 0.4,
            color: textColor,
            background: `linear-gradient(135deg, ${textColor} 0%, ${color} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginTop: '0.5rem'
          }}
        >
          FocusSync
        </span>
      )}
    </div>
  );
};

export default FocusSyncLogo;

