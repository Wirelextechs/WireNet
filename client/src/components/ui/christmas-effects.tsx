import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Snowflake {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

export function Snowfall({ enabled = true }: { enabled?: boolean }) {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSnowflakes([]);
      return;
    }

    // Create snowflakes
    const flakes: Snowflake[] = [];
    for (let i = 0; i < 50; i++) {
      flakes.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 10,
        size: 4 + Math.random() * 8,
        opacity: 0.4 + Math.random() * 0.6,
      });
    }
    setSnowflakes(flakes);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <motion.div
          key={flake.id}
          className="absolute text-white"
          initial={{ y: -20, x: `${flake.x}vw`, opacity: 0 }}
          animate={{
            y: "110vh",
            x: [`${flake.x}vw`, `${flake.x + (Math.random() * 10 - 5)}vw`],
            opacity: [0, flake.opacity, flake.opacity, 0],
          }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ fontSize: flake.size }}
        >
          ❄
        </motion.div>
      ))}
    </div>
  );
}

export function ChristmasLights({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;

  const colors = ["#ff0000", "#00ff00", "#ffff00", "#ff00ff", "#00ffff", "#ff8800"];
  const lights = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    delay: i * 0.2,
  }));

  return (
    <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none overflow-hidden h-8">
      <div className="flex justify-between px-2">
        {lights.map((light) => (
          <motion.div
            key={light.id}
            className="relative"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{
              duration: 1.5,
              delay: light.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div
              className="w-3 h-4 rounded-full"
              style={{
                backgroundColor: light.color,
                boxShadow: `0 0 10px ${light.color}, 0 0 20px ${light.color}`,
              }}
            />
            <div
              className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-gray-800"
            />
          </motion.div>
        ))}
      </div>
      {/* Wire */}
      <svg className="absolute top-2 left-0 w-full h-4" style={{ zIndex: -1 }}>
        <path
          d="M0,8 Q50,2 100,8 T200,8 T300,8 T400,8 T500,8 T600,8 T700,8 T800,8 T900,8 T1000,8 T1100,8 T1200,8 T1300,8 T1400,8 T1500,8 T1600,8 T1700,8 T1800,8 T1900,8 T2000,8"
          stroke="#333"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function ChristmasBanner({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-red-600 via-green-600 to-red-600 text-white py-2 text-center font-medium"
    >
      <span className="mr-2">🎄</span>
      Merry Christmas & Happy Holidays!
      <span className="ml-2">🎅</span>
    </motion.div>
  );
}

export function ChristmasEffects({
  snowfall = true,
  lights = false,
  banner = true,
}: {
  snowfall?: boolean;
  lights?: boolean;
  banner?: boolean;
}) {
  return (
    <>
      <Snowfall enabled={snowfall} />
      <ChristmasLights enabled={lights} />
      <ChristmasBanner enabled={banner} />
    </>
  );
}

export default ChristmasEffects;
