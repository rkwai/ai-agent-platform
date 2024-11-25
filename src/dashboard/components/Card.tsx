import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div 
    className={`rounded-lg border border-gray-200 bg-white shadow ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div 
    className={`px-6 py-4 border-b border-gray-200 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardContent: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div 
    className={`px-6 py-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div 
    className={`px-6 py-4 border-t border-gray-200 ${className}`}
    {...props}
  >
    {children}
  </div>
); 