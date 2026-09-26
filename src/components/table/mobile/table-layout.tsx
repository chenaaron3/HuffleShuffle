import type { ReactNode } from 'react';
import { useTableViewport } from '~/hooks/use-is-mobile-landscape';

interface MobileTableLayoutProps {
  desktopContent: ReactNode;
  mobileContent: ReactNode;
}

/**
 * Mounts only the active shell so hidden desktop overlays cannot portal on top of mobile.
 */
export function MobileTableLayout({ desktopContent, mobileContent }: MobileTableLayoutProps) {
  const { isDesktop, isMobileLandscape } = useTableViewport();

  if (isDesktop) {
    return <div className="h-full w-full">{desktopContent}</div>;
  }

  if (isMobileLandscape) {
    return <div className="h-full w-full">{mobileContent}</div>;
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-black text-white">
      <div className="text-center px-6">
        <div className="text-2xl mb-4">📱</div>
        <h2 className="text-xl font-semibold mb-2">Rotate Your Device</h2>
        <p className="text-zinc-400">
          Please rotate your device to landscape mode to play.
        </p>
      </div>
    </div>
  );
}
