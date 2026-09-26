import { motion } from 'framer-motion';
import { Hand } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { GlowingEffect } from '~/components/effects/glowing-effect';
import { useActions } from '~/hooks/use-actions';
import { useCanVolunteerShow } from '~/hooks/use-table-selectors';
import { cn } from '~/lib/utils';

export function ShowHandControl({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const canVolunteer = useCanVolunteerShow(userId);
  const { mutate: performAction, isPending } = useActions();

  if (!canVolunteer) return null;

  const handleShowHand = () => {
    performAction('VOLUNTEER_SHOW', undefined, {
      onSuccess: () => toast.success('Others can now see your hand'),
    });
  };

  return (
    <motion.div
      key="show-hand-control"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 24,
        mass: 0.7,
      }}
      className={cn(
        'relative border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur',
        compact ? 'w-36 rounded-lg p-1.5' : 'w-48 rounded-xl p-3',
      )}
    >
      <GlowingEffect
        disabled={false}
        spread={compact ? 12 : 25}
        proximity={compact ? 20 : 40}
        inactiveZone={0.3}
        borderWidth={compact ? 1 : 2}
        variant="golden"
        className={compact ? 'rounded-lg' : 'rounded-xl'}
      />
      <Button
        onClick={handleShowHand}
        disabled={isPending}
        variant="default"
        size="sm"
        className={cn(
          'w-full bg-amber-500 text-white hover:bg-amber-600',
          compact && 'h-7 px-2 text-[11px]',
        )}
      >
        <Hand className={cn(compact ? 'mr-1 h-3 w-3' : 'mr-1.5 h-3.5 w-3.5')} />
        Show Hand
      </Button>
    </motion.div>
  );
}
