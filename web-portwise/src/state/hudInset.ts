/**
 * Screen area covered by HUD chrome (bottom sheet / side card), in CSS px.
 * The 3D camera shifts its projection so the focused object sits in the visible part of the map.
 * Read every frame, so it is a plain module value rather than React state.
 */
let inset = { left: 0, bottom: 0 };

export const hudInset = {
  get: (): { left: number; bottom: number } => inset,
  set: (left: number, bottom: number): void => {
    if (inset.left === left && inset.bottom === bottom) return;
    inset = { left, bottom };
  },
};
