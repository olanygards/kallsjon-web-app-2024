import { useState, useEffect, useRef } from "react";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";

interface WindData {
  time: string;
  speed: number;
  gust: number;
  direction: number;
}

interface WindMapProps {
  windData: WindData[];
  date: string;
  onDateChange?: (direction: 'prev' | 'next') => void;
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

export default function WindMap({ windData, date, onDateChange }: WindMapProps) {
  const [timeIndex, setTimeIndex] = useState(2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseMapImg = useRef(new Image());
  const maskImg = useRef(new Image());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const streaksRef = useRef<any[]>([]);
  const timeRef = useRef<number>(0);

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

    const { speed, direction } = windData[timeIndex];
    
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
      loadImage(baseMapImg.current, "/lake-map-kall-trees.svg"),
      loadImage(maskImg.current, "/lake-map-kall-mask.svg"),
    ]).then(() => {
      console.log("✅ Both images loaded. Starting animation...");
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
      <h2 className="text-lg md:text-xl font-bold text-center">Lake Wind Conditions</h2>
      
      <div className="flex justify-between items-center px-2">
        <Button 
          className="text-black bg-black" 
          onClick={() => onDateChange?.('prev')}
        >
          &lt;
        </Button>
        <h3 className="font-semibold">{date} <br></br>{windData[timeIndex]?.time || '--:--'}</h3>
        <Button 
          className="text-black bg-black" 
          onClick={() => onDateChange?.('next')}
        >
          &gt;
        </Button>
      </div>

      <div className="text-center space-y-4">
        <p className="text-2xl text-white items-center gap-2">
  <span className="font-bold">{windData[timeIndex]?.speed}</span>
  <span className="text-lg">({windData[timeIndex]?.gust})</span> m/s
  <br />
  <span className="items-center gap-1">
    {windData[timeIndex]?.direction}°
    <svg
      className="inline-block"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: `rotate(${windData[timeIndex]?.direction - 180}deg)` }}
    >
      <path d="M12 2L15 8H9L12 2Z" fill="currentColor" />
      <path d="M12 22V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </span>
</p>

      <div className="space-y-3">
        <Slider
          min={0}
          max={windData.length - 1}
          step={1}
          value={timeIndex}
          onChange={setTimeIndex}
          data={windData}
          className="relative z-10"
        />
        <div className="flex justify-between text-sm text-white">
          <span>00:00</span>
          <span>12:00</span>
          <span>23:59</span>
        </div>
      </div>

      <div className="relative w-full aspect-square rounded-lg overflow-hidden mainBG">
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

      </div>
    </div>
  );
} 