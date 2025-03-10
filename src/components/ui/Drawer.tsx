import { useState, useEffect, ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { NavLink } from 'react-router-dom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function Drawer({ isOpen, onClose, children }: DrawerProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Duration should match the Tailwind duration-300 class (300ms)
  const TRANSITION_DURATION = 300;

  useEffect(() => {
    
    let timer: NodeJS.Timeout;
  
    if (isOpen) {
      setIsRendered(true);
      
      timer = setTimeout(() => {
        setIsAnimating(true);
      }, 10);
    } else {
      setIsAnimating(false);
  
      timer = setTimeout(() => {
        setIsRendered(false);
      }, TRANSITION_DURATION);
    }
  
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isRendered) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden"
      onClick={onClose}
    >
      {/* Backdrop with fade transition */}
      <div 
  className={`absolute inset-0 bg-black transition-opacity duration-300 ${isAnimating ? 'opacity-50' : 'opacity-0'}`}
/>
      
      {/* Drawer panel with slide transition */}
      <div 
        className="fixed inset-y-0 right-0 max-w-full flex outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className={`
            w-screen max-w-md transform transition-transform duration-300 ease-in-out
            ${isAnimating ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {/* Drawer content */}
          <div className="h-full flex flex-col bg-kallsjon-lt-green shadow-xl">
            <div className="px-4 py-6 bg-kallsjon-lt-green text-white flex items-center justify-between">
              <h2 className="text-5xl font-bold">Meny</h2>
              <button
                onClick={onClose}
                className="rounded-md bg-kallsjon-green text-white focus:outline-none"
              >
                <XMarkIcon className="h-8 w-" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DrawerNavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => 
        `block px-6 py-8 text-3xl font-bold ${
          isActive ? 'bg-kallsjon-green text-white' : 'text-white hover:bg-gray-100'
        }`
      }
    >
      {label}
    </NavLink>
  );
} 