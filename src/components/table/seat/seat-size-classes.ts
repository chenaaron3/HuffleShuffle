/** Shared mobile overlay tile size — player video and compact hand camera. */
export const OVERLAY_TILE_WIDTH_PX = 160;
export const OVERLAY_TILE_HEIGHT_PX = 100;
export const OVERLAY_TILE_HEIGHT_CLASS = 'h-[6.25rem] min-h-[6.25rem]';
export const OVERLAY_TILE_WIDTH_CLASS = 'w-40 min-w-40 shrink-0';
export const OVERLAY_TILE_SIZE_CLASS = `${OVERLAY_TILE_HEIGHT_CLASS} ${OVERLAY_TILE_WIDTH_CLASS}`;

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
            heightClass: OVERLAY_TILE_HEIGHT_CLASS,
            widthClass: OVERLAY_TILE_WIDTH_CLASS,
            aspectStyle: undefined,
        };
    }
    return {
        heightClass: fullHeight ? 'h-full' : 'h-[22vh]',
        widthClass: fullHeight ? 'w-auto' : 'w-[34.22vh]',
        aspectStyle: fullHeight ? ({ aspectRatio: '34.22/22' } as const) : undefined,
    };
}
