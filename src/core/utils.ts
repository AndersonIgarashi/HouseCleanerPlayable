export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Frame-rate independent exponential smoothing factor. */
export const damp = (lambda: number, dtMs: number) => 1 - Math.exp(-lambda * (dtMs / 1000));

export const hexToNum = (hex: string) => parseInt(hex.replace('#', ''), 16);

export function vibrate(pattern: number | number[], enabled: boolean): void {
  const activation = (navigator as any).userActivation;
  if (!enabled || (activation && !activation.hasBeenActive)) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    // some webviews expose vibrate but throw when called without permission
  }
}
