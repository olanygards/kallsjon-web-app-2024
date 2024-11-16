import { FaStar } from 'react-icons/fa';

interface WindRatingProps {
  avgWind: number;
  gustWind: number;
}

export function WindRating({ avgWind, gustWind }: WindRatingProps) {
  const getAdjustedWindSpeed = (avg: number, gust: number): number => {
    if (!avg || !gust || avg === 0) return 0;
    
    const ratio = gust / avg;
    const result = avg + ratio;
    return result;
  };

  const adjustedWind = getAdjustedWindSpeed(avgWind, gustWind);

  const getStarCount = (adjustedWind: number): number => {
    if (!adjustedWind || adjustedWind < 0) return 0;
    if (adjustedWind >= 16) return 5;
    if (adjustedWind >= 14) return 4;
    if (adjustedWind >= 13) return 3;
    if (adjustedWind >= 12) return 2;
    if (adjustedWind >= 11) return 1;
    return 0;
  };

  const getWindColor = (adjustedWind: number): string => {
    if (!adjustedWind || adjustedWind < 0) return '#74747417';
    if (adjustedWind >= 19.0) return '#720288'; 
    if (adjustedWind >= 18.5) return '#cc0e93'; 
    if (adjustedWind >= 17.0) return '#761103'; 
    if (adjustedWind >= 16.5) return '#8c1a06'; 
    if (adjustedWind >= 16.0) return '#a02109'; 
    if (adjustedWind >= 15.5) return '#ad3c1f';  
    if (adjustedWind >= 15.0) return '#a55c3b';  
    if (adjustedWind >= 14.5) return '#005b2f';  
    if (adjustedWind >= 13.0) return '#00703a';  
    if (adjustedWind >= 12.5) return '#0b7c46';  
    if (adjustedWind >= 12.0) return '#388957';  
    if (adjustedWind >= 11.5) return '#49654c96'; 
    if (adjustedWind >= 11.0) return '#9bb798'; 
    return '#74747417'; 
  };

  const starCount = getStarCount(adjustedWind);
  const starColor = getWindColor(adjustedWind);

  return (
    <div className="flex">
      {[...Array(5)].map((_, index) => (
        <FaStar
          key={index}
          color={index < starCount ? starColor : '#E5E7EB'}
        />
      ))}
    </div>
  );
}
