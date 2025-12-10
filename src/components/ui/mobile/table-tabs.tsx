import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Video } from 'lucide-react';

type TabId = 'dealer' | 'betting';

interface MobileTableTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: {
    dealer: React.ReactNode;
    betting: React.ReactNode;
  };
}

export function MobileTableTabs({ activeTab, onTabChange, children }: MobileTableTabsProps) {
  // Toggle between tabs
  const handleToggle = () => {
    onTabChange(activeTab === 'dealer' ? 'betting' : 'dealer');
  };

  // Icon shows the tab you'll switch TO (inverse of current tab)
  const toggleIcon = activeTab === 'dealer'
    ? <Coins className="h-5 w-5" /> // Show betting icon when on dealer tab
    : <Video className="h-5 w-5" />; // Show dealer icon when on betting tab

  const toggleLabel = activeTab === 'dealer' ? 'Switch to Betting' : 'Switch to Dealer';

  return (
    <div className="relative h-full w-full bg-black">
      {/* Toggle Button - Left Middle */}
      <button
        onClick={handleToggle}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-50 rounded-lg bg-zinc-900/90 backdrop-blur-sm border border-white/10 p-2 text-white hover:bg-zinc-800/90 transition-colors shadow-lg"
        aria-label={toggleLabel}
      >
        {toggleIcon}
      </button>

      {/* Tab Content - Full Height */}
      <div className="relative h-full w-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full"
          >
            {activeTab === 'dealer' && (
              <div className="h-full w-full">{children.dealer}</div>
            )}
            {activeTab === 'betting' && (
              <div className="h-full w-full overflow-hidden">{children.betting}</div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
