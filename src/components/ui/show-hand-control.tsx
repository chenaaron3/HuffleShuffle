import { motion } from 'framer-motion';
import { Hand } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { GlowingEffect } from '~/components/ui/glowing-effect';
import { useActions } from '~/hooks/use-actions';
import { useCanVolunteerShow } from '~/hooks/use-table-selectors';

export function ShowHandControl() {
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
      className="relative rounded-xl shadow-2xl w-48 bg-zinc-900/95 border border-white/10 p-3 backdrop-blur"
    >
      <GlowingEffect
        disabled={false}
        spread={25}
        proximity={40}
        inactiveZone={0.3}
        borderWidth={2}
        variant="golden"
        className="rounded-xl"
      />
      <Button
        onClick={handleShowHand}
        disabled={isPending}
        variant="default"
        size="sm"
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
      >
        <Hand className="w-3.5 h-3.5 mr-1.5" />
        Show Hand
      </Button>
    </motion.div>
  );
}
