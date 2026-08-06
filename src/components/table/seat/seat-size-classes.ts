export function getSeatSizeClasses(fullHeight: boolean) {
    return {
        heightClass: fullHeight ? 'h-full' : 'h-[22vh]',
        widthClass: fullHeight ? 'w-auto' : 'w-[34.22vh]',
        aspectStyle: fullHeight ? ({ aspectRatio: '34.22/22' } as const) : undefined,
    };
}
