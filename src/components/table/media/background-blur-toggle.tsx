import { useBackgroundBlur } from '~/hooks/use-background-blur';
import { cn } from '~/lib/utils';

interface BackgroundBlurToggleProps {
    className?: string;
    compact?: boolean;
}

export function BackgroundBlurToggle({ className, compact = false }: BackgroundBlurToggleProps) {
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
                'flex items-center justify-center rounded-md text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                compact ? 'h-auto w-6 p-0' : 'h-9 px-2',
                className,
            )}
        >
            <span
                className={cn(
                    'rounded border font-semibold uppercase tracking-wide transition-colors',
                    compact
                        ? 'flex w-full items-center justify-center px-0 py-0.5 text-[8px]'
                        : 'px-2 py-0.5 text-[10px]',
                    enabled
                        ? 'border-white/90 bg-white text-black'
                        : 'border-white/70 bg-white/10 text-white/90',
                )}
            >
                Blur
            </span>
        </button>
    );
}
