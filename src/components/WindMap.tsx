import { useState, useEffect, useRef, useMemo } from "react";
import { Slider } from "./ui/slider";

interface WindData {
  time: string;
  speed: number;
  gust: number;
  direction: number;
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

export default function WindMap({ windData, forecastData = [] }: WindMapProps) {
  const [timeIndex, setTimeIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseMapImg = useRef(new Image());
  const maskImg = useRef(new Image());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const streaksRef = useRef<any[]>([]);
  const timeRef = useRef<number>(0);

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
    
    console.log('WindMap data sources:', {
      observedCount: observedData.length,
      forecastCount: forecastOnly.length,
      observedSample: observedData.slice(0, 1),
      forecastSample: forecastOnly.slice(0, 1)
    });
    
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
    
    // Log the merged data to debug
    console.log('WindMap merged data:', {
      totalLength: allData.length,
      firstForecastIndex: allData.findIndex(d => d.isForecast),
      hasForecast: allData.some(d => d.isForecast),
      forecastCount: allData.filter(d => d.isForecast).length,
      onlyForecast: allData.length > 0 && allData.every(d => d.isForecast)
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
      console.log('Only forecast data available - setting forecastStartIndex to 0');
      return 0;
    }
    
    // Find the index of the first forecast item
    const firstForecastIndex = mergedData.findIndex(data => data.isForecast);
    console.log(`Found first forecast at index ${firstForecastIndex} of ${mergedData.length}`);
    
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
    
    console.log('Slider data prepared:', {
      length: mappedData.length,
      forecastStartIndex,
      speedSamples: mappedData.slice(0, 5).map(d => d.speed),
      minSpeed,
      forecastSpeeds: mappedData.filter(d => d.isForecast).map(d => d.speed).slice(0, 5)
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
    
    timeRef.current += 0.1;
    updateStreaks(waveCanvas, speed, direction);

    // Draw waves with correct masking order
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    
    // Step 1: Draw streaks first
    drawStreaks(waveCtx, speed, direction);
    
    // Step 2: Apply the mask after
    waveCtx.globalCompositeOperation = "destination-in";
    waveCtx.drawImage(maskImg.current, 0, 0, waveCanvas.width, waveCanvas.height);
    waveCtx.globalCompositeOperation = "source-over";

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
      {/* Wind data display */}
      <div 
        className="flex justify-between p-3 mb-4 rounded-lg shadow" 
        style={{ backgroundColor: "rgb(252 255 252)" }}
      >
        <div className="text-center" style={{ width: '25%' }}>
          <div className="text-sm text-gray-500">Tid:</div>
          <div className="text-xl font-bold">
            {mergedData[timeIndex]?.time || '--:--'}
          </div>
        </div>
        
        <div className="text-center" style={{ width: '45%' }}>
          <div className="text-sm text-gray-500">Vindhastighet</div>
          <div className="text-xl font-bold whitespace-nowrap">
            {mergedData[timeIndex] ? 
              `${mergedData[timeIndex].speed.toFixed(1)} (${mergedData[timeIndex].gust.toFixed(1)}) m/s` : 
              '-- (--) m/s'}
          </div>
        </div>
        
        <div className="text-center" style={{ width: '30%' }}>
          <div className="text-sm text-gray-500">Riktning</div>
          <div className="text-xl font-bold flex items-center justify-center">
            {mergedData[timeIndex] ? `${mergedData[timeIndex].direction}°` : '--°'}
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