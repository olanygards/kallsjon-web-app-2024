import { motion } from "framer-motion";

interface CarAnimationProps {
  windSpeed: number;
}

const CarAnimation = ({ windSpeed }: CarAnimationProps) => {
  // Use the road path from the SVG file
  const roadPath = "M1177.2,759.9c-44.2,2.8-111.1-15-144.8-6.7-33.7,8.3-33.3,48.1-34.4,73.1-1.1,25.1-35.4,19.1-78.1,21.5-42.6,2.4-56.3-2.4-76.1,12.9-19.8,15.2-6.1,54.8,0,119.8,6.1,65,111.1,99.4,154.2,116.2,43,16.7,74.2,76.1,90.8,105.1,16.6,28.9,68.6,27.4,100.6,64.3,32,36.9,44.2,81.8,69.1,116.8,24.9,35,89.3,10.7,143.1,16.7,53.8,6.1,115.2,35,139.6,51.8s77.6,62.4,92.3,91.3c14.7,28.9,11.2,71.6,0,131.7-11.2,60.1-1,64.7,0,96.7,1,32-40.6,18.3-48.1,4.6-7.5-13.7-21.4-77.6-33.6-99.2-12.2-21.5-79.2-30.2-117.2-39.4s-73.1-48.7-109.6-63.9-44.2-15.2-61.2,13.4c-17,28.6,27.6,91.7,37.5,114.6,9.8,23,48,65.3,0,79.1-48,13.7-73.8-21.3-92.1-40.1-18.3-18.8-28.9,23.3-56.3,32.5-27.4,9.1-39.6,26.4-20.2,74.6,19.4,48.2-16.4,36.5-16.4,36.5,0,0-35.8-25.8-52.6-33.8-16.8-8-54.6-5.8-75.2-43.9-20.6-38-84.9-57-125.1-51.9s-133,24.8-157.9,36.5c-24.8,11.7-61.4,23.4-93.5,19.7";

  // Only render animation if wind speed is above 10 m/s
  if (windSpeed < 10) {
    return null;
  }

  // Calculate animation speed based on wind speed
  const animationDuration = Math.max(60, 200 / windSpeed); // Slower when less wind, faster when more wind

  return (
    <motion.svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none", // Allow clicks to pass through
      }}
      viewBox="0 0 1920 1920"
    >
      {/* Show the path for debugging - can be removed in production */}
      {/* <motion.path d={roadPath} stroke="rgba(255,0,0,0.2)" fill="transparent" strokeWidth="3" /> */}
      
      {/* First car animation */}
      <motion.g
        style={{ originX: "50%", originY: "50%" }}
        initial={{ scale: 0.5 }}
      >
        <motion.image
          href="/surfbus.svg"
          width="80"
          height="40"
          style={{
            offsetPath: `path('${roadPath}')`,
            offsetRotate: "auto",
          }}
          animate={{
            offsetDistance: ["0%", "100%"],
          }}
          transition={{
            duration: animationDuration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </motion.g>

      {/* Second car with delay */}
      <motion.g
        style={{ originX: "50%", originY: "50%" }}
        initial={{ scale: 0.4 }}
      >
        <motion.image
          href="/surfbus.svg"
          width="70"
          height="35"
          style={{
            offsetPath: `path('${roadPath}')`,
            offsetRotate: "auto",
          }}
          animate={{
            offsetDistance: ["0%", "100%"],
          }}
          transition={{
            duration: animationDuration * 1.2,
            repeat: Infinity,
            ease: "linear",
            delay: animationDuration * 0.3, // Add delay for staggered effect
          }}
        />
      </motion.g>
    </motion.svg>
  );
};

export default CarAnimation; 