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
            heightClass: 'h-[6.25rem] min-h-[6.25rem]',
            widthClass: 'w-40 min-w-40 shrink-0',
            aspectStyle: undefined,
        };
    }
    return {
        heightClass: fullHeight ? 'h-full' : 'h-[22vh]',
        widthClass: fullHeight ? 'w-auto' : 'w-[34.22vh]',
        aspectStyle: fullHeight ? ({ aspectRatio: '34.22/22' } as const) : undefined,
    };
}
