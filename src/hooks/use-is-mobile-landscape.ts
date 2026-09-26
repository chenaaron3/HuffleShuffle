import { useEffect, useState } from 'react';

/**
 * Viewport layout for the table shell.
 * Desktop = width >= 1024 (Tailwind `lg`).
 * Mobile landscape = width < 1024 and width > height.
 */
export function useTableViewport() {
  const [layout, setLayout] = useState<{
    isDesktop: boolean;
    isMobileLandscape: boolean;
  }>(() => {
    if (typeof window === 'undefined') {
      return { isDesktop: false, isMobileLandscape: false };
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isDesktop = width >= 1024;
    return { isDesktop, isMobileLandscape: !isDesktop && width > height };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const check = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isDesktop = width >= 1024;
      setLayout({
        isDesktop,
        isMobileLandscape: !isDesktop && width > height,
      });
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return layout;
}

/** @deprecated Prefer useTableViewport — kept for existing callers. */
export function useIsMobileLandscape() {
  return useTableViewport().isMobileLandscape;
}
