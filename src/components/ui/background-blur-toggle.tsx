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
                'flex h-9 items-center justify-center rounded-md px-2 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                !enabled && 'opacity-60',
                className,
            )}
        >
            <span
                className={cn(
                    'rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    enabled
                        ? 'border-white/90 bg-white text-black'
                        : 'border-white/40 text-white/70',
                )}
            >
                Blur
            </span>
        </button>
    );
}

