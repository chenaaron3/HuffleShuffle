import { Focus } from 'lucide-react';
import { useBackgroundBlur } from '~/hooks/use-background-blur';
import { cn } from '~/lib/utils';

interface BackgroundBlurToggleProps {
    className?: string;
}

export function BackgroundBlurToggle({ className }: BackgroundBlurToggleProps) {
    const { enabled, supported, toggle } = useBackgroundBlur();

    if (!supported) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={enabled}
            aria-label={enabled ? 'Disable background blur' : 'Enable background blur'}
            title={enabled ? 'Disable background blur' : 'Enable background blur'}
            className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-white transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                !enabled && 'opacity-60',
                className,
            )}
        >
            <span className='text-xs border-2 p-0.5'>blur</span>
        </button>
    );
}

