/**
 * Keep a window inside the viewport. Pure function for reuse and testing.
 *
 * Returns a new {x, y, width, height} clamped so the window remains visible
 * even after the viewport shrinks. Width/height are not enlarged.
 */

export interface RectInput {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ViewportBounds {
    width: number;
    height: number;
    /** Reserved space at the top (e.g. OS top bar). */
    insetTop?: number;
    /** Reserved space at the bottom (e.g. windows tray). */
    insetBottom?: number;
}

const MIN_VISIBLE_EDGE = 80;

export function clampToViewport(rect: RectInput, bounds: ViewportBounds): RectInput {
    const insetTop = bounds.insetTop ?? 0;
    const insetBottom = bounds.insetBottom ?? 0;
    const usableHeight = Math.max(0, bounds.height - insetTop - insetBottom);

    const width = Math.min(rect.width, bounds.width);
    const height = Math.min(rect.height, usableHeight);

    const maxX = bounds.width - MIN_VISIBLE_EDGE;
    const minX = -(width - MIN_VISIBLE_EDGE);
    const x = Math.min(Math.max(rect.x, minX), maxX);

    const maxY = bounds.height - insetBottom - MIN_VISIBLE_EDGE;
    const minY = insetTop;
    const y = Math.min(Math.max(rect.y, minY), maxY);

    return { x, y, width, height };
}
