import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700
        ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
