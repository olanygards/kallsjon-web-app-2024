import { useState, useEffect, useRef, useMemo } from "react";
import { Slider } from "./ui/slider";
import { WindRating } from "./WindRating";

interface WindData {
  time: string;
  speed: number;
  gust: number;
  direction: number;
}

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

  // Define highlight areas - these are surf spots that work with specific wind conditions
  const highlightAreas: HighlightArea[] = [
    { x: 240, y: 160, radius: 8, minSpeed: 10, directionRange: [250, 310], label: "Sulviken" }, 
    { x: 230, y: 135, radius: 8, minSpeed: 12, directionRange: [225, 250], label: "Revet" }, 
    { x: 265, y: 315, radius: 8, minSpeed: 10, directionRange: [295, 359], label: "Grundsviken" },   
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
    highlightAreas.forEach(({ x, y, radius, minSpeed, directionRange, label }) => {
      const [minDir, maxDir] = directionRange;

      // Check if wind conditions match
      if (windSpeed >= minSpeed && 
          ((windDirection >= minDir && windDirection <= maxDir) || 
           (minDir > maxDir && (windDirection >= minDir || windDirection <= maxDir)))) {
        
        // Calculate pulsating effect for the circle
        const pulse = Math.abs(Math.sin(timeRef.current * 0.4)) * 0.4 + 0.7; // Pulsating effect
        
        // Draw highlight circle with pulsating effect
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.7})`; // Golden highlight with fading effect
        ctx.fill();
        
        // Draw a border with pulsating effect
        ctx.strokeStyle = `rgba(255, 140, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add label if provided - with static opacity (no pulsating)
        if (label) {
          // Draw text background for better readability
          const textWidth = ctx.measureText(label).width;
          
          // Draw text with full opacity (static, not pulsating)
          ctx.fillStyle = 'rgba(255, 255, 255, 1.0)'; // White text, full opacity
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + textWidth/2, y - 10); // Position text above the circle
        }
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
    
    // Removed drawFlashingHighlight call from here since we call it separately in animate()
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

    const { speed, direction } = mergedData[timeIndex];
    
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
    const loadImage = (img: HTMLImageElement, src: string) =>
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = src;
      });

    Promise.all([
      loadImage(baseMapImg.current, "/lake-map-kall-back.svg"),
      loadImage(maskImg.current, "/lake-map-kall-mask.svg"),
    ]).then(() => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      streaksRef.current = [];
      timeRef.current = 0;
      animate();
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [timeIndex]);

  return (
    <div className="p-2 space-y-3 md:p-4 md:space-y-4 w-full md:max-w-2xl mx-auto">
      {/* Wind data display - updated styling */}
      <div className="mb-2">
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
      <div className="relative w-full aspect-square">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="absolute top-2 left-0 w-full h-full"
        />
        <canvas
          ref={waveCanvasRef}
          width={400}
          height={400}
          className="absolute top-2 left-0 w-full h-full"
        />
      </div>

      {/* Slider */}
      <div className="relative pt-4">
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
        <div className="flex justify-between text-sm text-white mt-2">
          <span>{mergedData.length > 0 ? mergedData[0].time : "00:00"}</span>
          <span>{mergedData.length > 0 ? mergedData[Math.floor(mergedData.length / 2)].time : "12:00"}</span>
          <span>{mergedData.length > 0 ? mergedData[mergedData.length - 1].time : "23:59"}</span>
        </div>
      </div>
    </div>
  );
} 