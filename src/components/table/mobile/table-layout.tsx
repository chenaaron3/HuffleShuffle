import { useState } from 'react';
import { useIsMobileLandscape } from '~/hooks/use-is-mobile-landscape';

import { MobileTableTabs } from './table-tabs';

type TabId = 'dealer' | 'betting';

interface MobileTableLayoutProps {
  /**
   * Desktop layout component - rendered on larger screens
   */
  desktopContent: React.ReactNode;

  /**
   * Mobile tab content - organized by tab
   */
  mobileContent: {
    dealer: React.ReactNode;
    betting: React.ReactNode;
  };
}

/**
 * Wrapper component that conditionally renders mobile tabs or desktop layout.
 * On mobile landscape (< 1024px width, width > height), shows swipeable tabs.
 * On desktop, shows the standard layout.
 * 
 * This component is non-invasive - it doesn't modify any child components,
 * it just reorganizes them based on screen size.
 */
export function MobileTableLayout({ desktopContent, mobileContent }: MobileTableLayoutProps) {
  const isMobileLandscape = useIsMobileLandscape();
  const [activeTab, setActiveTab] = useState<TabId>('dealer');

  // Always render both, use CSS to show/hide based on screen size
  // This prevents layout shifts and works with SSR
  return (
    <>
      {/* Desktop Layout - Hidden on mobile (< 1024px) */}
      <div className="hidden lg:block h-full w-full">
        {desktopContent}
      </div>

      {/* Mobile Landscape Layout - Only visible on mobile landscape */}
      {isMobileLandscape ? (
        <div className="lg:hidden h-full w-full">
          <MobileTableTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            children={mobileContent}
          />
        </div>
      ) : (
        // Fallback for mobile portrait - show message to rotate
        <div className="lg:hidden h-full w-full flex items-center justify-center bg-black text-white">
          <div className="text-center px-6">
            <div className="text-2xl mb-4">📱</div>
            <h2 className="text-xl font-semibold mb-2">Rotate Your Device</h2>
            <p className="text-zinc-400">
              Please rotate your device to landscape mode to play.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
