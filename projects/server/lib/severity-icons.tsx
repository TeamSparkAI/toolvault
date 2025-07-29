import React from 'react';

interface IconProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const getSizeClasses = (size?: IconProps['size']) => {
  switch (size) {
    case 'sm': return 'w-4 h-4';
    case 'lg': return 'w-8 h-8';
    case 'xl': return 'w-10 h-10';
    case 'md':
    default: return 'w-5 h-5';
  }
};

export const CriticalIcon: React.FC<IconProps> = ({ size, className = 'text-red-600' }) => (
  <svg 
    className={`${getSizeClasses(size)} ${className}`}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    />
  </svg>
);

export const HighIcon: React.FC<IconProps> = ({ size, className = 'text-orange-500' }) => (
  <svg 
    className={`${getSizeClasses(size)} ${className}`}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
    />
  </svg>
);

export const MediumIcon: React.FC<IconProps> = ({ size, className = 'text-yellow-500' }) => (
  <svg 
    className={`${getSizeClasses(size)} ${className}`}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M12 3L21 12L12 21L3 12L12 3Z" 
    />
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M12 8v8" 
    />
  </svg>
);

export const LowIcon: React.FC<IconProps> = ({ size, className = 'text-blue-500' }) => (
  <svg 
    className={`${getSizeClasses(size)} ${className}`}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
  >
    <rect 
      x="4" 
      y="4" 
      width="16" 
      height="16" 
      rx="3" 
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M8 12h8" 
    />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ size, className = 'text-gray-500' }) => (
  <svg 
    className={`${getSizeClasses(size)} ${className}`}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={2} 
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    />
  </svg>
); 