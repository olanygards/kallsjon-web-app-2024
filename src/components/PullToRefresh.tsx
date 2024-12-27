import { useState } from 'react';
import { useSpring, animated } from '@react-spring/web';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  
  const [{ y }, api] = useSpring(() => ({
    y: 0,
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
    
    if (diff > 0) {
      api.start({ y: diff / 2 });
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    const currentY = y.get();
    if (currentY > 100) {
      try {
        api.start({ y: 50 });
        await onRefresh();
      } finally {
        api.start({ y: 0 });
      }
    } else {
      api.start({ y: 0 });
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <animated.div style={{ transform: y.to(y => `translateY(${y}px)`) }}>
        {isDragging && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            {y.get() > 50 ? 'Släpp för att uppdatera' : 'Dra ner för att uppdatera'}
          </div>
        )}
        {children}
      </animated.div>
    </div>
  );
}
