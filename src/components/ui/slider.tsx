import { useMemo } from 'react';

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  data?: Array<{ speed: number }>;
  forecastStartIndex?: number;
}

const getWindColor = (speed: number): string => {
  // Ensure speed is at least positive for color determination
  const adjustedSpeed = Math.max(0.1, speed);
  
  // Light green to solid green gradient for speeds 1 to 10
  if (adjustedSpeed <= 1) return "#ddf3dd"; // Very light green
  if (adjustedSpeed <= 3) return "#cde8cd";
  if (adjustedSpeed <= 5) return "#bddcc5";
  if (adjustedSpeed <= 9) return "#abd0bd";
  if (adjustedSpeed <= 11) return "#428979";  // Solid green

  // Transition from red to dark purple for speeds 13-15
  if (adjustedSpeed <= 12) return "#f2352d"; // Starting to darken
  if (adjustedSpeed <= 13) return "#e02c40"; // More purple undertone
  if (adjustedSpeed <= 14) return "#c82048"; // Approaching dark purple

  // Transition from dark purple to fluorescent purple for speeds 16-18
  if (adjustedSpeed <= 16) return "#a51055"; // Dark purple
  if (adjustedSpeed <= 17) return "#8e0d63"; // Deepening the purple
  if (adjustedSpeed <= 18) return "#a80e7b"; // Transitioning toward fluorescent

  // Fluorescent purple for speeds 19-20
  if (adjustedSpeed <= 19) return "#cc0e93"; // Fluorescent purple
  if (adjustedSpeed <= 20) return "#d0209b"; // More intense fluorescent purple

  // Fallback for speeds above 20
  return "#e130a3"; // Final intense fluorescent purple
};

const createGradientBackground = (data: Array<{ speed: number }> | undefined, forecastStartIndex?: number) => {
  // Default background if no data
  if (!data || data.length === 0) {
    console.log('No data for gradient, using default gray');
    return 'linear-gradient(to right, #f1f1f1, #e1e1e1)';
  }
  
  // Log the data to help diagnose issues
  console.log('Creating gradient with:', {
    dataPoints: data.length,
    speeds: data.map(d => d.speed).slice(0, 5),
    forecastStartIndex,
    allForecast: forecastStartIndex === 0
  });
  
  // If there's only 1 data point, create a solid color gradient
  if (data.length === 1) {
    const color = getWindColor(data[0].speed);
    return `linear-gradient(to right, ${color}, ${color})`;
  }
  
  // Create the gradient stops
  const gradientStops = data.map((item, index) => {
    const percentage = (index / (data.length - 1)) * 100;
    const color = getWindColor(item.speed);
    
    // Apply transparency to forecast data
    const isForecast = forecastStartIndex !== undefined && 
                      (index >= forecastStartIndex || forecastStartIndex === 0);
                      
    if (isForecast) {
      // Extract RGB values from the color - properly handling hex colors
      let r = 0, g = 0, b = 0;
      
      // Handle hex colors (#RRGGBB format)
      if (color.startsWith('#') && color.length === 7) {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
        console.log(`Parsed hex color ${color} to RGB: ${r},${g},${b}`);
      } 
      // Handle rgb(r,g,b) format
      else if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          [r, g, b] = matches.map(Number);
        }
      }
      
      return `rgba(${r}, ${g}, ${b}, 0.7) ${percentage}%`;
    }
    
    return `${color} ${percentage}%`;
  });
  
  if (gradientStops.length === 0) {
    return 'linear-gradient(to right, #f1f1f1, #e1e1e1)';
  }
  
  return `linear-gradient(to right, ${gradientStops.join(', ')})`;
};

export function Slider({ min, max, step, value, onChange, className = '', data, forecastStartIndex }: SliderProps) {
  const backgroundStyle = useMemo(() => {
    const gradient = createGradientBackground(data, forecastStartIndex);
    console.log('Applied gradient:', gradient);
    
    // Ensure we have a fallback color to avoid black backgrounds
    return { 
      background: gradient,
      backgroundColor: '#abd0bd' // Fallback color (green) if gradient fails
    };
  }, [data, forecastStartIndex]);

  // Ensure max is valid
  const validMax = max >= min ? max : min;

  return (
    <div className={`relative flex items-center w-full h-9 touch-none ${className}`}>
      <div 
        className="absolute w-full h-9 rounded-full cursor-pointer" 
        style={backgroundStyle}
      />
      <input
        type="range"
        min={min}
        max={validMax}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="relative w-full h-5 appearance-none bg-transparent cursor-pointer
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-9 [&::-webkit-slider-thumb]:h-9
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f1f1f1]
                 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-400
                 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-colors
                 [&::-webkit-slider-thumb]:hover:border-gray-500"
      />
    </div>
  );
} 