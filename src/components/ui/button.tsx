import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-white text-kallsjon-green-dark hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-kallsjon-green focus:ring-offset-2 disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
); 