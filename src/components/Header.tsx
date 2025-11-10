import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Drawer, DrawerNavItem } from './ui/Drawer';
import logoImage from '../assets/kallifornien-logo-lg-green.png';

interface HeaderProps {
  onLogoClick?: () => void;
}

// Throttle function to limit how often the scroll handler fires
function throttle(func: Function, limit: number): (...args: any[]) => void {
  let inThrottle: boolean = false;
  return function(...args: any[]) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function Header({ onLogoClick }: HeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const lastScrollY = useRef(0);
  
  // Calculate scaling factor based on scroll position, ensuring it never exceeds 1.0
  const scale = Math.min(1, Math.max(0.8, 1 - (Math.max(0, scrollY) / 50) * 0.2));
  const headerPadding = Math.min(1, Math.max(0.6, 1 - (Math.max(0, scrollY) / 50) * 0.4)); 

  useEffect(() => {
    // Check if we're in standalone mode (launched from homescreen)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isInStandaloneMode);
    
    // Apply safe area inset top if in standalone mode
    if (isInStandaloneMode) {
      // Apply the background color to the html element to extend under status bar
      document.documentElement.style.backgroundColor = '#96b9a3';
    }
  }, []);
  
  // Add scroll listener to track scroll position
  useEffect(() => {
    // For iOS, we need to make sure the event listener is added after a small delay
    const initializeScrollListener = () => {
      // This function handles the actual scroll detection
      const handleScroll = () => {
        // First try the #root element which should work in PWA mode
        const scrollElement = document.getElementById('root');
        let currentScrollY = 0;
        
        if (scrollElement) {
          currentScrollY = scrollElement.scrollTop;
        } else {
          // Fallback to window.scrollY for browser mode
          currentScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        }
        
        // Only update state if the scroll position changed significantly (reduces jitter)
        if (Math.abs(currentScrollY - lastScrollY.current) > 1) {
          // Prevent negative scroll values which can happen during bounce
          currentScrollY = Math.max(0, currentScrollY);
          setScrollY(currentScrollY);
          lastScrollY.current = currentScrollY;
        }
      };
      
      // Throttle the scroll handler to improve performance and reduce jitter
      const throttledHandleScroll = throttle(handleScroll, 10);
      
      // Check what element should receive the scroll event
      // For iOS, document might be more reliable
      const scrollElement = document.getElementById('root') || document;
      
      // Try to capture scroll events at the document level for iOS
      document.addEventListener('scroll', throttledHandleScroll, { passive: true });
      
      // Also add to the root element which works better in PWA mode on some devices
      if (scrollElement && scrollElement !== document) {
        scrollElement.addEventListener('scroll', throttledHandleScroll, { passive: true });
      }
      
      // Call handleScroll once to initialize
      handleScroll();
      
      // Clean up function to remove all listeners
      return () => {
        document.removeEventListener('scroll', throttledHandleScroll);
        if (scrollElement && scrollElement !== document) {
          scrollElement.removeEventListener('scroll', throttledHandleScroll);
        }
      };
    };
    
    // Small delay to ensure DOM is ready, helps on iOS
    const timer = setTimeout(initializeScrollListener, 100);
    
    // Return cleanup function
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <>
      <header 
        className="top-0 sticky z-50 shadow-sm will-change-transform" 
        style={{ 
          backgroundColor: '#96b9a3',
          paddingTop: isStandalone ? 'env(safe-area-inset-top)' : '0',
          transition: 'all 0.2s cubic-bezier(0.33, 1, 0.68, 1)'
        }}
      >
        <div 
          className="max-w-[640px] mx-auto flex items-center justify-between will-change-transform"
          style={{
            padding: `${0.5 * headerPadding}rem ${1 * headerPadding}rem`,
            transition: 'all 0.2s cubic-bezier(0.33, 1, 0.68, 1)'
          }}
        >
          {onLogoClick ? (
            <button
              onClick={onLogoClick}
              className="flex items-center will-change-transform cursor-pointer bg-transparent border-none p-0"
              style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'left center',
                transition: 'transform 0.2s cubic-bezier(0.33, 1, 0.68, 1)'
              }}
            >
              <img 
                src={logoImage} 
                alt="Kall-ifornien Logo" 
                className="h-8 w-auto"
              />
            </button>
          ) : (
            <Link 
              to="/" 
              className="flex items-center will-change-transform cursor-pointer"
              style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'left center',
                transition: 'transform 0.2s cubic-bezier(0.33, 1, 0.68, 1)'
              }}
            >
              <img 
                src={logoImage} 
                alt="Kall-ifornien Logo" 
                className="h-8 w-auto"
              />
            </Link>
          )}
          
          <button
            onClick={openDrawer}
            className="p-0 bg-kallsjon-lt-green text-kallsjon-lt-green-light hover:bg-gray-100 rounded-md will-change-transform"
            style={{ 
              transform: `scale(${scale})`, 
              transformOrigin: 'right center',
              transition: 'transform 0.2s cubic-bezier(0.33, 1, 0.68, 1)'
            }}
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>
      </header>

      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer}>
        <div className="py-2">
          <DrawerNavItem to="/" label="Hem" onClick={closeDrawer} />
          <DrawerNavItem to="/now" label="Now" onClick={closeDrawer} />
          <DrawerNavItem to="/chart" label="Grafer" onClick={closeDrawer} />
          <DrawerNavItem to="/experiments" label="Statistik" onClick={closeDrawer} />
        </div>
      </Drawer>
    </>
  );
}
