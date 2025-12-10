import { useEffect, useState } from 'react';

/**
 * Hook to detect if the device is a mobile device in landscape orientation.
 * Uses viewport width (< 1024px) and checks if width > height for landscape.
 * This matches Tailwind's `lg:` breakpoint (1024px).
 */
export function useIsMobileLandscape() {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    const checkMobileLandscape = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Mobile landscape: width < 1024px (lg breakpoint) AND width > height
      const isMobile = width < 1024;
      const isLandscape = width > height;
      setIsMobileLandscape(isMobile && isLandscape);
    };

    // Check immediately
    checkMobileLandscape();

    // Listen for resize and orientation changes
    window.addEventListener("resize", checkMobileLandscape);
    window.addEventListener("orientationchange", checkMobileLandscape);

    return () => {
      window.removeEventListener("resize", checkMobileLandscape);
      window.removeEventListener("orientationchange", checkMobileLandscape);
    };
  }, []);

  return isMobileLandscape;
}
