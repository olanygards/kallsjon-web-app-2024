import { useState, useEffect, ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { NavLink } from 'react-router-dom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function Drawer({ isOpen, onClose, children }: DrawerProps) {
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
    } else {
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300); // Match this to the transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
        style={{ opacity: isOpen ? '1' : '0' }}
      />
      
      <div 
        className="fixed inset-y-0 right-0 max-w-full flex outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="w-screen max-w-md transform transition-transform duration-300 ease-in-out"
          style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        >
          <div className="h-full flex flex-col bg-white shadow-xl">
            <div className="px-4 py-6 bg-kallsjon-green-dark text-white flex items-center justify-between">
              <h2 className="text-lg font-medium">Meny</h2>
              <button
                onClick={onClose}
                className="rounded-md text-white hover:text-gray-300 focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
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
        `block px-4 py-3 text-base font-medium border-b border-gray-200 ${
          isActive ? 'bg-kallsjon-green text-white' : 'text-gray-700 hover:bg-gray-100'
        }`
      }
    >
      {label}
    </NavLink>
  );
} 