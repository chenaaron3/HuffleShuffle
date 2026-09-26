export function getSeatSizeClasses(fullHeight: boolean, overlay = false, fill = false) {
    if (overlay && fill) {
        return {
            heightClass: 'h-full',
            widthClass: 'w-full',
            aspectStyle: undefined,
        };
    }
    if (overlay) {
        return {
            heightClass: 'h-40 min-h-40',
            widthClass: 'w-64 min-w-64 shrink-0',
            aspectStyle: undefined,
        };
    }
    return {
        heightClass: fullHeight ? 'h-full' : 'h-[22vh]',
        widthClass: fullHeight ? 'w-auto' : 'w-[34.22vh]',
        aspectStyle: fullHeight ? ({ aspectRatio: '34.22/22' } as const) : undefined,
    };
}
