import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  data?: Array<{ speed: number }>;  // Add data prop for wind speeds
}

const getWindColor = (speed: number): string => {
  if (speed <= 7) return "#747474";  //  Gray
  if (speed <= 8) return "#9bb798";    // Light Green Gray
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

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ min, max, step, value, onChange, className = '', data }, ref) => {
    const backgroundStyle = React.useMemo(() => ({
      background: createGradientBackground(data)
    }), [data]);

    return (
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        className={`relative flex items-center w-full h-9 touch-none ${className}`}
      >
        <SliderPrimitive.Track 
          className="relative h-5 w-full grow rounded-full cursor-pointer" 
          style={backgroundStyle}
        >
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-transparent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb 
          className="block h-12 w-12 rounded-full bg-white border-2 border-gray-400 shadow-lg ring-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 touch-none"
        />
      </SliderPrimitive.Root>
    );
  }
); 