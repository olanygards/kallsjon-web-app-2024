import { useState } from 'react';
import { useSpring, animated } from '@react-spring/web';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  
  const [styles, api] = useSpring(() => ({
    transform: 'translateY(0px)',
    config: { tension: 200, friction: 20 }
  }));

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    // Lägg till deadzone och minska känslighet
    if (diff > 20) { // Deadzone: 20px innan rörelse börjar
      api.start({ transform: `translateY(${(diff - 20) / 3}px)` }); // Mindre rörelse (diff/3 istället för diff/2)
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    const currentTransform = styles.transform.get();
    const match = currentTransform.match(/translateY\((.*?)px\)/);
    const currentY = match ? parseFloat(match[1]) : 0;
    
    if (currentY > 80) { // Sänkt från 100 till 80px (pga deadzone)
      try {
        api.start({ transform: 'translateY(50px)' });
        await onRefresh();
      } finally {
        api.start({ transform: 'translateY(0px)' });
      }
    } else {
      api.start({ transform: 'translateY(0px)' });
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <animated.div style={styles}>
        {isDragging && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            {styles.transform.get().match(/translateY\((.*?)px\)/) && 
             parseFloat(styles.transform.get().match(/translateY\((.*?)px\)/)?.[1] || '0') > 60 
              ? 'Släpp för att uppdatera' 
              : 'Dra ner för att uppdatera'}
          </div>
        )}
        {children}
      </animated.div>
    </div>
  );
}
