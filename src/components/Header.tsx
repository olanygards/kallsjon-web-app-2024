import { useState, useEffect } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Drawer, DrawerNavItem } from './ui/Drawer';
import logoImage from '../assets/kall-ifornien-logo-lg-green.png';

interface HeaderProps {
  // Remove the title prop since we're not using it
}

export function Header({}: HeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  
  // Calculate scaling factor based on scroll position - using 80px instead of 200px for faster shrinking
  const scale = Math.max(0.8, 1 - (scrollY / 50) * 0.2); // Will go from 1 to 0.8 as you scroll just 50px
  const headerPadding = Math.max(0.6, 1 - (scrollY / 50) * 0.4); // Reduce padding more aggressively

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
        if (scrollElement) {
          setScrollY(scrollElement.scrollTop);
        } else {
          // Fallback to window.scrollY for browser mode
          setScrollY(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0);
        }
      };
      
      // Check what element should receive the scroll event
      // For iOS, document might be more reliable
      const scrollElement = document.getElementById('root') || document;
      
      // Try to capture scroll events at the document level for iOS
      document.addEventListener('scroll', handleScroll, { passive: true });
      
      // Also add to the root element which works better in PWA mode on some devices
      if (scrollElement && scrollElement !== document) {
        scrollElement.addEventListener('scroll', handleScroll, { passive: true });
      }
      
      // Also listen for touchmove which can help on iOS
      document.addEventListener('touchmove', handleScroll, { passive: true });
      
      // Call handleScroll once to initialize
      handleScroll();
      
      // Clean up function to remove all listeners
      return () => {
        document.removeEventListener('scroll', handleScroll);
        document.removeEventListener('touchmove', handleScroll);
        if (scrollElement && scrollElement !== document) {
          scrollElement.removeEventListener('scroll', handleScroll);
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
        className="top-0 sticky z-50 shadow-sm transition-all duration-200 ease-in-out" 
        style={{ 
          backgroundColor: '#96b9a3',
          paddingTop: isStandalone ? 'env(safe-area-inset-top)' : '0'
        }}
      >
        <div 
          className="max-w-[640px] mx-auto flex items-center justify-between transition-all duration-200 ease-in-out"
          style={{
            padding: `${0.5 * headerPadding}rem ${1 * headerPadding}rem` // Scale padding with scroll
          }}
        >
          <div className="flex items-center transition-transform duration-200 ease-in-out"
               style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}>
            <img 
              src={logoImage} 
              alt="Kall-ifornien Logo" 
              className="h-8 w-auto"
            />
          </div>
          
          <button
            onClick={openDrawer}
            className="p-2 text-kallsjon-green-dark hover:bg-gray-100 rounded-md transition-transform duration-200 ease-in-out"
            style={{ transform: `scale(${scale})`, transformOrigin: 'right center' }}
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>
      </header>

      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer}>
        <div className="py-2">
          <DrawerNavItem to="/" label="Dagsvy" onClick={closeDrawer} />
          <DrawerNavItem to="/chart" label="Graf vy" onClick={closeDrawer} />
          <DrawerNavItem to="/experiments" label="Experiment" onClick={closeDrawer} />
        </div>
      </Drawer>
    </>
  );
}
