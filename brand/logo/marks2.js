/* Boreal — Direction 3 (Double Wave) refinement, V2.
   Goal: keep the "solid, sober, Silver-Tsunami stripes" character of 3a while
   killing the ≈ (approximately-equal) reading that appears at 24px.
   120×120 viewBox, currentColor, one color, zero effect. */

const W2 = {
  /* 0 — BASELINE. V1 3a untouched. Two near-identical S-curves, distinct weights.
        Kept only as the reference that reads as ≈ at small sizes. */
  v0: () => `
    <g transform="translate(0 -15)">
      <path fill="none" stroke="currentColor" stroke-width="7"  d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60"/>
    </g>
    <g transform="translate(7 16)">
      <path fill="none" stroke="currentColor" stroke-width="13" d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60"/>
    </g>`,

  /* A — CURVE ASYMMETRY. Top nearly flat (slight inflection), bottom pronounced.
        Two different curve profiles → a shape that exists on no keyboard. */
  vA: () => `
    <path fill="none" stroke="currentColor" stroke-width="7"
      d="M8 48 C 32 44 48 52 60 48 C 74 43 92 54 112 48"/>
    <path fill="none" stroke="currentColor" stroke-width="13"
      d="M8 74 C 26 50 48 50 60 74 C 73 96 92 96 112 74"/>`,

  /* B — AGGRESSIVE HORIZONTAL OFFSET. One stripe starts well left of the other.
        Dynamic, un-stacked, distinct weights. */
  vB: () => `
    <g transform="translate(0 -15)">
      <path fill="none" stroke="currentColor" stroke-width="7"
        d="M0 60 C 22 44 38 44 48 60 C 58 76 74 76 96 60"/>
    </g>
    <g transform="translate(24 15)">
      <path fill="none" stroke="currentColor" stroke-width="13"
        d="M0 60 C 22 44 38 44 48 60 C 58 76 74 76 96 60"/>
    </g>`,

  /* C — EXTREME WEIGHT CONTRAST. One rippled near-rectangle, one near-line.
        Reads as data hierarchy / report columns, never punctuation. */
  vC: () => `
    <g transform="translate(0 -13)">
      <path fill="none" stroke="currentColor" stroke-width="3"
        d="M8 60 C 30 42 46 42 60 60 C 74 78 90 78 112 60"/>
    </g>
    <g transform="translate(0 14)">
      <path fill="none" stroke="currentColor" stroke-width="22"
        d="M8 60 C 30 44 46 44 60 60 C 74 76 90 76 112 60"/>
    </g>`,

  /* D — SLIGHT DIAGONAL. Whole lockup tilted ~6° → movement / north heading. */
  vD: () => `
    <g transform="rotate(-6 60 60)">
      <g transform="translate(0 -13)">
        <path fill="none" stroke="currentColor" stroke-width="7"  d="M10 60 C 30 44 46 44 60 60 C 74 76 90 76 110 60"/>
      </g>
      <g transform="translate(6 14)">
        <path fill="none" stroke="currentColor" stroke-width="13" d="M10 60 C 30 44 46 44 60 60 C 74 76 90 76 110 60"/>
      </g>
    </g>`,

  /* E — TIDEMARK (free). A thin contour line over a solid undulating mass.
        One element is a filled landform, not a stripe → cannot be read as ≈,
        yet stays in the topographic "water / coastline" register. */
  vE: () => `
    <path fill="none" stroke="currentColor" stroke-width="3"
      d="M8 42 C 30 30 46 54 60 42 C 74 30 90 54 112 42"/>
    <path fill="currentColor"
      d="M8 102 V70 C 30 54 46 84 60 70 C 74 56 90 84 112 70 V102 Z"/>`,
};

let __u2 = 0;
function wmark(key, { size = 120, color = '#FFFBF4', cls = '' } = {}) {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 120 120"
    role="img" aria-label="Boreal wave mark" style="color:${color};display:block">${W2[key]()}</svg>`;
}

window.W2 = W2;
window.wmark = wmark;
