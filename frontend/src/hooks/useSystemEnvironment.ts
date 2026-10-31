import { useState, useEffect } from 'react';

export type TimeOfDayPeriod = 'dawn' | 'day' | 'dusk' | 'night';
export type ScreenDeviceType = 'mobile' | 'tablet' | 'desktop';

export interface SystemEnvironment {
  // Screen detection
  screenWidth: number;
  screenHeight: number;
  deviceType: ScreenDeviceType;
  isDesktop: boolean;
  isMobile: boolean;

  // Local Computer Time detection
  currentTimeString: string;
  currentHour: number;
  timePeriod: TimeOfDayPeriod;
  periodLabelFr: string;

  // Ambient atmosphere classes & styles
  ambientBackgroundClass: string;
}

export function useSystemEnvironment(): SystemEnvironment {
  // 1. Screen size state
  const [screenSize, setScreenSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  // 2. Real-time computer clock state
  const [now, setNow] = useState(() => new Date());

  // Listen to window resize
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update computer clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes().toString().padStart(2, '0');
  const currentTimeString = `${currentHour}:${currentMinutes}`;

  // Time-of-day classification based on local computer time
  let timePeriod: TimeOfDayPeriod = 'night';
  let periodLabelFr = 'Nuit';
  let ambientBackgroundClass = 'from-[#070b14] via-[#090f1d] to-[#04060b]';

  if (currentHour >= 6 && currentHour < 9) {
    timePeriod = 'dawn';
    periodLabelFr = 'Aurore';
    ambientBackgroundClass = 'from-[#141e30] via-[#1a2c42] to-[#0d1624]';
  } else if (currentHour >= 9 && currentHour < 18) {
    timePeriod = 'day';
    periodLabelFr = 'Plein jour';
    ambientBackgroundClass = 'from-[#0f1d38] via-[#13284d] to-[#091224]';
  } else if (currentHour >= 18 && currentHour < 21) {
    timePeriod = 'dusk';
    periodLabelFr = 'Crépuscule';
    ambientBackgroundClass = 'from-[#1f1528] via-[#191d30] to-[#0b0f19]';
  } else {
    timePeriod = 'night';
    periodLabelFr = 'Nuit';
    ambientBackgroundClass = 'from-[#070b14] via-[#090f1d] to-[#04060b]';
  }

  const deviceType: ScreenDeviceType =
    screenSize.width < 768 ? 'mobile' : screenSize.width < 1024 ? 'tablet' : 'desktop';

  return {
    screenWidth: screenSize.width,
    screenHeight: screenSize.height,
    deviceType,
    isDesktop: deviceType === 'desktop',
    isMobile: deviceType === 'mobile',
    currentTimeString,
    currentHour,
    timePeriod,
    periodLabelFr,
    ambientBackgroundClass,
  };
}
