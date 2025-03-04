import { useMemo } from 'react';

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  data?: Array<{ speed: number }>;
}

const getWindColor = (speed: number): string => {
  // Light green to solid green gradient for speeds 1 to 10
  if (speed <= 1) return "#ddf3dd";
  if (speed <= 3) return "#cde8cd";
  if (speed <= 5) return "#bddcc5";
  if (speed <= 9) return "#abd0bd";
  if (speed <= 11) return "#428979";  // Solid green

  // Transition from red to dark purple for speeds 13-15
  if (speed <= 12) return "#f2352d"; // Starting to darken
  if (speed <= 13) return "#e02c40"; // More purple undertone
  if (speed <= 14) return "#c82048"; // Approaching dark purple

  // Transition from dark purple to fluorescent purple for speeds 16-18
  if (speed <= 16) return "#a51055"; // Dark purple
  if (speed <= 17) return "#8e0d63"; // Deepening the purple
  if (speed <= 18) return "#a80e7b"; // Transitioning toward fluorescent

  // Fluorescent purple for speeds 19-20
  if (speed <= 19) return "#cc0e93"; // Fluorescent purple
  if (speed <= 20) return "#d0209b"; // More intense fluorescent purple

  // Fallback for speeds above 20
  return "#e130a3"; // Final intense fluorescent purple
};

const createGradientBackground = (data: Array<{ speed: number }> | undefined) => {
  if (!data) return 'bg-gray-200';
  
  const gradientStops = data.map((item, index) => {
    const percentage = (index / (data.length - 1)) * 100;
    const color = getWindColor(item.speed);
    return `${color} ${percentage}%`;
  });

  return `linear-gradient(to right, ${gradientStops.join(', ')})`;
};

export function Slider({ min, max, step, value, onChange, className = '', data }: SliderProps) {
  const backgroundStyle = useMemo(() => ({
    background: createGradientBackground(data)
  }), [data]);

  return (
    <div className={`relative flex items-center w-full h-9 touch-none ${className}`}>
      <div 
        className="absolute w-full h-9 rounded-full cursor-pointer" 
        style={backgroundStyle}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="relative w-full h-5 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-9 [&::-webkit-slider-thumb]:h-9 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f1f1f1] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:border-gray-500"
      />
    </div>
  );
} 