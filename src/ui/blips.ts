// DOM elements for the on-screen stop markers, keyed by zone id.
// The HUD renders them; the tracker inside the canvas moves them every frame without React re-renders.
export const blipEls = new Map<string, HTMLElement>()
