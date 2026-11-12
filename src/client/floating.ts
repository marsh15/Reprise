// Geometry for floating surfaces (citation card, options menu). Pure functions plus one DOM helper,
// so the placement rules can be read in one place.
export type Box = { left: number; top: number; right: number; bottom: number };
export type Placement = { left: number; top: number; width: number; height: number; maxHeight: number | null; side: 'above' | 'below' };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Anchors a card to a marker. Prefers above, flips below when above has no room, and when neither
 * side fits it takes the larger side and caps the height (the card scrolls). Horizontally the card
 * is centred on the marker and clamped inside `bounds` with `margin` on both sides.
 */
export function placeCard(marker: Box, size: { width: number; height: number }, bounds: Box, margin = 12, gap = 8): Placement {
  const width = Math.min(size.width, bounds.right - bounds.left - margin * 2);
  const left = clamp((marker.left + marker.right) / 2 - width / 2, bounds.left + margin, bounds.right - margin - width);
  const above = marker.top - bounds.top - gap;
  const below = bounds.bottom - marker.bottom - gap;
  if (size.height <= above) return { left, width, height: size.height, top: marker.top - gap - size.height, maxHeight: null, side: 'above' };
  if (size.height <= below) return { left, width, height: size.height, top: marker.bottom + gap, maxHeight: null, side: 'below' };
  const side = above >= below ? 'above' : 'below';
  const room = Math.max(96, Math.floor(side === 'above' ? above : below));
  const height = Math.min(size.height, room);
  return { left, width, height, maxHeight: room, side, top: side === 'above' ? marker.top - gap - height : marker.bottom + gap };
}

/** Bottom-sheet placement used below 768px: full width minus margin, resting just above `floor`. */
export function placeSheet(bounds: Box, floor: number, size: { height: number }, margin = 12, gap = 8): Placement {
  const room = Math.max(96, Math.floor(Math.min((bounds.bottom - bounds.top) * 0.6, floor - bounds.top - gap)));
  const height = Math.min(size.height, room);
  return { left: bounds.left + margin, width: bounds.right - bounds.left - margin * 2, height, top: floor - gap - height, maxHeight: height < size.height ? room : null, side: 'above' };
}

/**
 * Viewport position of the point `position: fixed; left: 0; top: 0` resolves to. That is (0, 0)
 * unless an ancestor establishes a containing block for fixed descendants (the thread container
 * query applies layout containment), so coordinates measured from getBoundingClientRect are
 * translated by this origin before being written to `left`/`top`.
 */
export function fixedOrigin(element: HTMLElement): { x: number; y: number } {
  element.style.left = '0px'; element.style.top = '0px';
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}
