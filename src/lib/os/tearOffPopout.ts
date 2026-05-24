import { getOsViewportBounds } from './viewportBounds';

const EDGE_THRESHOLD = 24;

/** True when the pointer released outside the OS canvas usable area. */
export function isPointerOutsideOsViewport(clientX: number, clientY: number): boolean {
    const bounds = getOsViewportBounds();
    const insetTop = bounds.insetTop ?? 0;
    const insetBottom = bounds.insetBottom ?? 0;
  const maxY = bounds.height - insetBottom;

    return clientX < 0 || clientX > bounds.width || clientY < insetTop || clientY > maxY;
}

/** True while dragging when the window is near or past a canvas edge (tear-off hint). */
export function isNearPopoutEdge(x: number, y: number, width: number, height: number): boolean {
    const bounds = getOsViewportBounds();
    const insetTop = bounds.insetTop ?? 0;
    const insetBottom = bounds.insetBottom ?? 0;
    const maxX = bounds.width - width;
    const maxY = bounds.height - insetBottom - height;

    return (
        x <= EDGE_THRESHOLD ||
        y <= insetTop + EDGE_THRESHOLD ||
        x >= maxX - EDGE_THRESHOLD ||
        y >= maxY - EDGE_THRESHOLD
    );
}

/** Map pointer + grab offset to screen coordinates for window.open placement. */
export function pointerToScreenPlacement(
    clientX: number,
    clientY: number,
    grabOffsetX: number,
    grabOffsetY: number
): { screenLeft: number; screenTop: number } {
    return {
        screenLeft: window.screenX + clientX - grabOffsetX,
        screenTop: window.screenY + clientY - grabOffsetY,
    };
}
