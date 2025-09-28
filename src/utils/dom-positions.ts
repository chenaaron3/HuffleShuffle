/**
 * Get the center position of a DOM element by its ID
 */
export function getElementCenterPosition(
  elementId: string,
): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;

  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with ID "${elementId}" not found`);
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Get the position of a DOM element by its ID
 */
export function getElementPosition(
  elementId: string,
): { x: number; y: number; width: number; height: number } | null {
  if (typeof window === "undefined") return null;

  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with ID "${elementId}" not found`);
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Get seat position by seat ID
 */
export function getSeatPosition(seatId: string): { x: number; y: number } {
  return getElementCenterPosition(`seat-${seatId}`)!;
}

/**
 * Get pot display position
 */
export function getPotPosition(): { x: number; y: number } {
  return getElementCenterPosition("pot-display")!;
}

/**
 * Wait for an element to appear in the DOM and return its position
 */
export function waitForElementPosition(
  elementId: string,
  timeout = 5000,
): Promise<{ x: number; y: number } | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkElement = () => {
      const position = getElementCenterPosition(elementId);
      if (position) {
        resolve(position);
        return;
      }

      if (Date.now() - startTime > timeout) {
        console.warn(`Timeout waiting for element "${elementId}"`);
        resolve(null);
        return;
      }

      // Check again in 100ms
      setTimeout(checkElement, 100);
    };

    checkElement();
  });
}
