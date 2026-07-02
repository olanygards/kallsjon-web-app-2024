import { useState, useEffect, useRef, useMemo } from "react";
import { Slider } from "./ui/slider";
import { WindRating } from "./WindRating";

interface WindData {
  time: string;
  speed: number;
  gust: number;
  direction: number;
}

type MergedWindPoint = WindData & { isForecast: boolean };

interface HighlightArea {
  x: number;
  y: number;
  radius: number;
  minSpeed: number;
  directionRange: [number, number];
  label?: string;
}

interface WindMapProps {
  windData: WindData[];
  forecastData?: WindData[];
}

function getWindColor(speed: number) {
  if (speed <= 2) return "rgba(255, 255, 255, 0.1)"; // Almost invisible
  if (speed <= 5) return "rgba(255, 255, 255, 0.2)"; // Very faint
  if (speed <= 7) return "rgba(255, 255, 255, 0.3)"; // Light
  if (speed <= 10) return "rgba(255, 255, 255, 0.4)"; // Medium-light
  if (speed <= 12) return "rgba(255, 255, 255, 0.5)"; // Medium
  if (speed <= 15) return "rgba(255, 255, 255, 0.6)"; // Strong
  if (speed <= 17) return "rgba(255, 255, 255, 0.7)"; // Stronger
  if (speed <= 19) return "rgba(255, 255, 255, 0.8)"; // Very strong
  if (speed <= 21) return "rgba(255, 255, 255, 0.9)"; // Intense white
  return "rgba(255, 255, 255, 1)"; // Max intensity
}

// Helper function to get direction arrow based on wind direction
const getDirectionArrow = (direction: number): string => {
  if (direction < 22.5 || direction >= 337.5) return "↓";
  if (direction >= 22.5 && direction < 67.5) return "↙";
  if (direction >= 67.5 && direction < 112.5) return "←";
  if (direction >= 112.5 && direction < 157.5) return "↖";
  if (direction >= 157.5 && direction < 202.5) return "↑";
  if (direction >= 202.5 && direction < 247.5) return "↗";
  if (direction >= 247.5 && direction < 292.5) return "→";
  return "↘";
};

export default function WindMap({ windData, forecastData = [] }: WindMapProps) {
  const [timeIndex, setTimeIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseMapImg = useRef(new Image());
  const maskImg = useRef(new Image());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const streaksRef = useRef<any[]>([]);
  const timeRef = useRef<number>(0);
  const latestWindSpeedRef = useRef<number>(0);
  const latestWindDirectionRef = useRef<number>(0);
  const timeIndexRef = useRef(timeIndex);
  const mergedDataRef = useRef<MergedWindPoint[]>([]);

  timeIndexRef.current = timeIndex;

  // Define highlight areas - these are surf spots that work with specific wind conditions
  const highlightAreas: HighlightArea[] = [
    { x: 240, y: 160, radius: 8, minSpeed: 10, directionRange: [250, 310], label: "Sulviken" }, 
    { x: 230, y: 135, radius: 8, minSpeed: 11, directionRange: [225, 250], label: "Revet" }, 
    { x: 230, y: 135, radius: 8, minSpeed: 14, directionRange: [250, 270], label: "Revet" }, 
    { x: 265, y: 315, radius: 8, minSpeed: 11, directionRange: [295, 359], label: "Grundsviken" },   
  ];

  // Merge and sort wind data and forecast data
  const mergedData = useMemo(() => {
    // Make sure we mark observed data as isForecast=false and forecast data as isForecast=true
    const observedData = windData.map(data => ({
      ...data,
      isForecast: false
    }));
    
    const forecastOnly = forecastData.map(data => ({
      ...data,
      isForecast: true // Explicitly mark as forecast data
    }));
        
    // Combine and sort
    const allData = [...observedData, ...forecastOnly].sort((a, b) => {
      // Ensure both are string times
      const timeA = String(a.time);
      const timeB = String(b.time);
      
      // Parse as dates to compare
      const dateA = new Date(`1970/01/01 ${timeA}`).getTime();
      const dateB = new Date(`1970/01/01 ${timeB}`).getTime();
      
      return dateA - dateB;
    });
    
    
    return allData;
  }, [windData, forecastData]);

  mergedDataRef.current = mergedData;

  useEffect(() => {
    setTimeIndex((prev) => {
      if (mergedData.length === 0) return 0;
      return Math.min(prev, mergedData.length - 1);
    });
  }, [mergedData.length]);

  // Calculate the index where forecast data starts
  const forecastStartIndex = useMemo(() => {
    // If no data, return -1
    if (mergedData.length === 0) return -1;
    
    // Check if all data is forecast
    const onlyForecast = mergedData.every(d => d.isForecast);
    if (onlyForecast) {
      return 0;
    }
    
    // Find the index of the first forecast item
    const firstForecastIndex = mergedData.findIndex(data => data.isForecast);  
    return firstForecastIndex;
  }, [mergedData]);
  
  // For slider component - log what we're passing
  const sliderData = useMemo(() => {
    // Check for zero wind speeds that might be causing black colors
    const zeroSpeedCount = mergedData.filter(d => d.speed === 0).length;
    if (zeroSpeedCount > 0) {
      console.warn(`Found ${zeroSpeedCount} entries with zero wind speed which will appear black`);
    }
    
    // Get the minimum wind speed value to ensure we have proper colors
    const minSpeed = Math.min(...mergedData.map(d => d.speed).filter(s => s > 0));
    
    const mappedData = mergedData.map(data => {
      // Ensure we have at least some wind speed for display purposes (prevent black)
      const adjustedSpeed = data.speed === 0 ? Math.max(minSpeed, 1) : data.speed;
      
      return { 
        speed: adjustedSpeed,
        originalSpeed: data.speed,
        isForecast: data.isForecast
      };
    });
        
    // Map to just what the Slider needs
    return mappedData.map(d => ({ speed: d.speed }));
  }, [mergedData, forecastStartIndex]);

  const createStreak = (canvas: HTMLCanvasElement, windSpeed: number) => {
    if (windSpeed < 2) return null;
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * (windSpeed / 2) + 5,
      speed: windSpeed * 0.02 + 0.05 + (Math.random() * 0.1),
      opacity: 1,
      waveOffset: Math.random() * Math.PI * 2,
    };
  };

  const updateStreaks = (canvas: HTMLCanvasElement, windSpeed: number, windDirection: number) => {
    const adjustedAngle = ((windDirection + 90) * Math.PI) / 180;
    const streaks = streaksRef.current;

    for (let i = 0; i < streaks.length; i++) {
      let streak = streaks[i];
      const motionFactor = windSpeed < 5 ? 0 : windSpeed < 10 ? 0.2 : 1;
      const sideMovement = windSpeed >= 5 ? Math.sin(timeRef.current * 0.02 + streak.waveOffset) * (windSpeed / 100) : 0;

      streak.x += Math.cos(adjustedAngle) * streak.speed * motionFactor;
      streak.y += Math.sin(adjustedAngle) * streak.speed * motionFactor + sideMovement;
      streak.opacity -= windSpeed < 5 ? 0.005 : windSpeed < 10 ? 0.01 : 0.02;
    }

    for (let i = streaks.length - 1; i >= 0; i--) {
      if (streaks[i].opacity <= 0) {
        streaks.splice(i, 1);
      }
    }

    const spawnRate = windSpeed < 5 ? 0.05 : windSpeed < 10 ? 0.3 : 0.6;
    for (let i = 0; i < (windSpeed / 5) * 5; i++) {
      if (Math.random() < spawnRate) {
        const newStreak = createStreak(canvas, windSpeed);
        if (newStreak) streaks.push(newStreak);
      }
    }

    latestWindSpeedRef.current = windSpeed;
    latestWindDirectionRef.current = windDirection;
  };

  const drawFlashingHighlight = (ctx: CanvasRenderingContext2D, windSpeed: number, windDirection: number) => {
    // Fine-tuning parameters for the white background circle
    const circleOffsetX = -0.4; // Horizontal offset: positive values move right, negative left
    const circleOffsetY = -0.4; // Vertical offset: positive values move down, negative up
    const circleRadiusMultiplier = 0.48; // Adjust circle size (larger values = larger circle)
    const fontSizeMultiplier = 2.4; // Adjust the star size
    
    highlightAreas.forEach(({ x, y, radius, minSpeed, directionRange, label }) => {
      const [minDir, maxDir] = directionRange;

      // Check if wind conditions match
      if (windSpeed >= minSpeed && 
          ((windDirection >= minDir && windDirection <= maxDir) || 
           (minDir > maxDir && (windDirection >= minDir || windDirection <= maxDir)))) {
        
        // Save the current context state
        ctx.save();
        
        // Set the font size based on radius (making it proportional)
        const fontSize = radius * fontSizeMultiplier;
        ctx.font = `${fontSize}px Arial`;
        
        // Calculate the appropriate circle size
        const circleRadius = fontSize * circleRadiusMultiplier;
        
        // First draw a white solid circle behind the star
        ctx.beginPath();
        ctx.arc(x + circleOffsetX, y + circleOffsetY, circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        // Draw a thin border around the white circle
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        // Remove shadow effects for the star
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw the Unicode star ✪
        ctx.fillStyle = '#FFCC00'; // Bright yellow color
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw the Unicode star character
        ctx.fillText('✪', x, y);
        
        // Add label if provided
        if (label) {
          // Position text to the right of the star
          const textX = x + circleRadius + 2; // Position to the right with some spacing
          const textY = y; // Keep at the same vertical position as the star
          
          // Add shadow only for the text
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          
          // Draw text with shadow for better visibility
          ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'left'; // Change text alignment to left for positioning to the right
          ctx.fillText(label, textX, textY);
        }
        
        // Restore context
        ctx.restore();
      }
    });
  };

  const drawStreaks = (ctx: CanvasRenderingContext2D, windSpeed: number, windDirection: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.strokeStyle = getWindColor(windSpeed);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    for (let streak of streaksRef.current) {
      ctx.globalAlpha = streak.opacity * 0.8;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(
        streak.x + Math.cos(((windDirection - 90) * Math.PI) / 180) * streak.length,
        streak.y + Math.sin(((windDirection - 90) * Math.PI) / 180) * streak.length
      );
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    
  };

  const animate = () => {
    // Increment time for the pulsating highlight effect
    timeRef.current += 0.1;
    
    const canvas = canvasRef.current;
    const waveCanvas = waveCanvasRef.current;
    if (!canvas || !waveCanvas) return;

    const ctx = canvas.getContext("2d");
    const waveCtx = waveCanvas.getContext("2d");
    if (!ctx || !waveCtx) return;

    // Draw base map
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseMapImg.current, 0, 0, canvas.width, canvas.height);

    const point = mergedDataRef.current[timeIndexRef.current];
    if (!point) return;

    const { speed, direction } = point;

    // Update wind references for highlights
    latestWindSpeedRef.current = speed;
    latestWindDirectionRef.current = direction;
    
    updateStreaks(waveCanvas, speed, direction);

    // Draw waves with correct masking order
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    
    // Step 1: Draw streaks first
    drawStreaks(waveCtx, speed, direction);
    
    // Step 2: Apply the mask after
    waveCtx.globalCompositeOperation = "destination-in";
    waveCtx.drawImage(maskImg.current, 0, 0, waveCanvas.width, waveCanvas.height);
    waveCtx.globalCompositeOperation = "source-over";
    
    // Step 3: Draw the highlights on top of the main canvas (not the wave canvas)
    // This ensures highlights appear on top of everything
    drawFlashingHighlight(ctx, speed, direction);

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    let cancelled = false;

    const loadImage = (img: HTMLImageElement, src: string) =>
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = src;
      });

    Promise.all([
      loadImage(baseMapImg.current, "/lake-map-kall-back.svg"),
      loadImage(maskImg.current, "/lake-map-kall-mask.svg"),
    ]).then(() => {
      if (cancelled) return;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      streaksRef.current = [];
      timeRef.current = 0;
      animate();
    });

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [timeIndex]);

  return (
    <div className="bg-white shadow rounded-b-lg p-4 w-full md:max-w-2xl mx-auto">
      {/* Wind data display - updated styling */}
      <div className="mb-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
          <div className="flex items-center">
            <div className="w-[70px] text-lg p-2 font-bold text-gray-900 dark:text-white">
              {mergedData[timeIndex]?.time || '--:--'}
            </div>
            <div className="flex-[2] flex items-center justify-end gap-4">
              <div className="flex flex-col items-center flex-[3]">
                <div className="text-base">
                  <span className="font-semibold">
                    {mergedData[timeIndex] ? mergedData[timeIndex].speed.toFixed(1) : '--'}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 text-sm">
                    {" "}({mergedData[timeIndex] ? mergedData[timeIndex].gust.toFixed(1) : '--'})
                  </span>
                  <span className="text-[0.8rem] text-gray-600 dark:text-gray-300"> m/s</span>
                </div>
                <div className="mt-1">
                  {mergedData[timeIndex] && (
                    <WindRating 
                      avgWind={mergedData[timeIndex].speed} 
                      gustWind={mergedData[timeIndex].gust} 
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 w-[55px]">
                <span className="text-sm">
                  {mergedData[timeIndex] ? `${mergedData[timeIndex].direction}°` : '--°'}
                </span>
                <span className="font-bold text-xl transform rotate-[270deg -90deg] inline-block">
                  {mergedData[timeIndex] ? getDirectionArrow(mergedData[timeIndex].direction) : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative w-full aspect-square overflow-hidden rounded-lg">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="absolute top-0 left-0 w-full h-full"
        />
        <canvas
          ref={waveCanvasRef}
          width={400}
          height={400}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>

      {/* Slider */}
      <div className="relative pt-6">
        <Slider
          min={0}
          max={mergedData.length > 0 ? mergedData.length - 1 : 0}
          step={1}
          value={timeIndex}
          onChange={setTimeIndex}
          data={sliderData}
          forecastStartIndex={forecastStartIndex >= 0 ? forecastStartIndex : undefined}
          className="relative z-10"
        />
        <div className="flex justify-between text-sm text-gray-600 mt-2">
          <span>{mergedData.length > 0 ? mergedData[0].time : "00:00"}</span>
          <span>{mergedData.length > 0 ? mergedData[Math.floor(mergedData.length / 2)].time : "12:00"}</span>
          <span>{mergedData.length > 0 ? mergedData[mergedData.length - 1].time : "23:59"}</span>
        </div>
      </div>
    </div>
  );
} 