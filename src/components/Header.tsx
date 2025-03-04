import { useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Drawer, DrawerNavItem } from './ui/Drawer';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center">
            <img 
              src="/src/assets/kall-ifornien-logo.png" 
              alt="Kall-ifornien Logo" 
              className="h-8 w-auto"
            />
          </div>
          
          <button
            onClick={openDrawer}
            className="p-2 text-kallsjon-green-dark hover:bg-gray-100 rounded-md"
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
