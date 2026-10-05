/**
 * Light haptic feedback for touch devices.
 *
 * - Android (Chrome, Samsung Internet, Firefox): `navigator.vibrate` with very short pulses.
 * - iOS 18+ Safari has no Vibration API, but toggling a native `<input type="checkbox" switch>`
 *   plays the system selection tick. We click a detached, hidden switch label to borrow it.
 *   iOS only honours it inside a user gesture (tap / release), so mid-drag ticks are Android-only.
 * - Mouse / trackpad devices never vibrate.
 */
export type HapticKind = "selection" | "light" | "medium" | "rigid" | "success";

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 6,
  light: 10,
  medium: 16,
  rigid: 22,
  success: [10, 70, 16],
};

/** Minimum gap between pulses so rapid events never turn into a continuous buzz. */
const MIN_GAP_MS = 45;

let lastAt = 0;
let support: "vibrate" | "ios-switch" | "none" | null = null;

function detect(): "vibrate" | "ios-switch" | "none" {
  if (typeof window === "undefined") return "none";
  if (!window.matchMedia("(pointer: coarse)").matches) return "none";
  if (typeof navigator.vibrate === "function") return "vibrate";
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS ? "ios-switch" : "none";
}

function iosTick(): void {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  // Lives in <head> so the synthetic click never bubbles into the React tree.
  document.head.appendChild(label);
  label.click();
  label.remove();
}

/** Plays a short haptic pulse on supported touch devices; a silent no-op everywhere else. */
export function haptic(kind: HapticKind = "selection"): void {
  support ??= detect();
  if (support === "none") return;
  const now = performance.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  try {
    if (support === "vibrate") navigator.vibrate(PATTERNS[kind]);
    else iosTick();
  } catch {
    support = "none";
  }
}

const TAPPABLE = "button, a[href], [role='switch'], [role='option'], [role='tab'], [cmdk-item]";

/**
 * One delegated listener gives every button, link, tab and search result a selection tick.
 * Elements can opt into a stronger pulse with `data-haptic="medium"` (etc.) or opt out with `data-haptic="off"`.
 * Returns a cleanup function.
 */
export function installTapHaptics(): () => void {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>(TAPPABLE);
    if (!el || el.matches(":disabled, [aria-disabled='true']")) return;
    const kind = el.closest<HTMLElement>("[data-haptic]")?.dataset.haptic;
    if (kind === "off") return;
    haptic(kind && kind in PATTERNS ? (kind as HapticKind) : "selection");
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
