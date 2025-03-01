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
  if (speed <= 7) return "#ffffff";  //  White
  if (speed <= 8) return "#f1f1f1";    // Light Gray
  if (speed <= 9) return "#49654c96";  // Soft Greenish Gray
  if (speed <= 10) return "#388957";   // Pastel Green
  if (speed <= 11) return "#0b7c46";   // Light Green
  if (speed <= 12) return "#00703a";   // Green
  if (speed <= 13) return "#005b2f";   // Deep Green
  if (speed <= 14) return "#a55c3b";   // Brownish Red
  if (speed <= 15) return "#ad3c1f";   // Reddish Orange
  if (speed <= 16) return "#a02109";   // Strong Red
  if (speed <= 17) return "#8c1a06";   // Darker Red
  if (speed <= 18) return "#761103";   // Deep Red
  if (speed <= 19) return "#cc0e93";   // Magenta
  return "#720288";                    // Dark Purple
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
        className="relative w-full h-5 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-9 [&::-webkit-slider-thumb]:h-9 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:border-gray-500"
      />
    </div>
  );
} 