let lockCount = 0;
let previousOverflow: { root: string; body: string } | null = null;

export function lockPageScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount === 1) {
    previousOverflow = {
      root: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
}

export function unlockPageScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.documentElement.style.overflow = previousOverflow?.root ?? '';
    document.body.style.overflow = previousOverflow?.body ?? '';
    previousOverflow = null;
  }
}

/** Each overlay owns one release function; repeated cleanup cannot unlock another overlay. */
export function acquirePageScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};
  lockPageScroll();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    unlockPageScroll();
  };
}
