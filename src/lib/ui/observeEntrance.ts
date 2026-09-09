/** Reveal once, releasing the observer immediately and cancelling delayed work on cleanup. */
export function observeEntrance(element: Element, reveal: () => void, delay: number): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    reveal();
    return () => {};
  }
  let disposed = false;
  let scheduled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new IntersectionObserver((entries) => {
    if (disposed || scheduled || !entries.some((entry) => entry.isIntersecting)) return;
    scheduled = true;
    observer.disconnect();
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed) reveal();
    }, delay);
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  observer.observe(element);
  return () => {
    disposed = true;
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
}
