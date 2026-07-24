export type ScrollIntoContainerOptions = {
  block?: 'start' | 'center' | 'end' | 'nearest';
  behavior?: ScrollBehavior;
  /** Extra inset from container edges when scrolling or checking visibility. */
  padding?: number;
};

/** Scroll an element into view within a scrollable container (not the document). */
function scrollElementIntoContainer(
  element: HTMLElement,
  container: HTMLElement,
  options: ScrollIntoContainerOptions = {}
): void {
  const { block = 'center', behavior = 'smooth', padding = 0 } = options;

  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const elementTop = elementRect.top - containerRect.top + container.scrollTop;
  const elementHeight = element.offsetHeight;
  const containerHeight = container.clientHeight;
  const pad = Math.max(0, padding);

  let targetScrollTop: number;
  switch (block) {
    case 'start':
      targetScrollTop = elementTop - pad;
      break;
    case 'end':
      targetScrollTop = elementTop + elementHeight - containerHeight + pad;
      break;
    case 'nearest': {
      const visibleTop = container.scrollTop + pad;
      const visibleBottom = container.scrollTop + containerHeight - pad;
      const elementBottom = elementTop + elementHeight;
      if (elementTop >= visibleTop && elementBottom <= visibleBottom) {
        return;
      }
      if (elementTop < visibleTop) {
        targetScrollTop = elementTop - pad;
      } else {
        targetScrollTop = elementBottom - containerHeight + pad;
      }
      break;
    }
    case 'center':
    default:
      targetScrollTop = elementTop - (containerHeight - elementHeight) / 2;
      break;
  }

  const maxScroll = Math.max(0, container.scrollHeight - containerHeight);
  container.scrollTo({
    top: Math.max(0, Math.min(targetScrollTop, maxScroll)),
    behavior,
  });
}

/** True when the element is fully visible inside the container's scrollport. */
function isElementInContainerView(
  element: HTMLElement,
  container: HTMLElement,
  padding = 0
): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const elementTop = elementRect.top - containerRect.top + container.scrollTop;
  const elementHeight = element.offsetHeight;
  const containerHeight = container.clientHeight;
  const pad = Math.max(0, padding);
  const visibleTop = container.scrollTop + pad;
  const visibleBottom = container.scrollTop + containerHeight - pad;
  const elementBottom = elementTop + elementHeight;
  return elementTop >= visibleTop && elementBottom <= visibleBottom;
}

/** Run scroll after layout (e.g. tab switch); double rAF helps after React paint. */
export function scrollElementIntoContainerAfterLayout(
  getElement: () => HTMLElement | null,
  container: HTMLElement | null,
  options?: ScrollIntoContainerOptions
): void {
  if (!container) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = getElement();
      if (el) scrollElementIntoContainer(el, container, options);
    });
  });
}
