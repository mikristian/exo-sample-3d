import React from 'react'
/** Actual CC0 MakeHuman OBJ mesh projected orthographically along depth.
 * Projected triangle raster silhouette, with both side contours simplified.
 * Static reference only; no Rust pattern or avatar geometry changes. */
const MESH_OUTLINE = 'M-0.60 -87.60 L-2.80 -87.20 L-4.40 -86.40 L-5.80 -85.20 L-7.40 -82.20 L-7.80 -80.80 L-8.00 -78.40 L-7.60 -75.60 L-9.20 -75.00 L-9.20 -73.80 L-7.80 -70.20 L-6.80 -69.80 L-6.00 -67.60 L-4.80 -65.60 L-4.80 -63.60 L-5.80 -60.80 L-6.40 -60.20 L-9.20 -58.80 L-16.60 -58.60 L-19.80 -57.60 L-23.80 -53.60 L-29.00 -44.80 L-30.80 -43.00 L-32.20 -40.80 L-38.40 -34.80 L-41.60 -31.20 L-44.80 -26.80 L-45.00 -26.20 L-47.80 -22.80 L-50.40 -18.20 L-51.40 -15.80 L-51.60 -13.60 L-52.20 -11.60 L-52.20 -11.20 L-51.80 -11.00 L-17.60 -10.80 L-18.20 -1.20 L-19.80 5.40 L-20.60 10.60 L-20.80 22.60 L-20.60 22.80 L-20.60 31.00 L-20.40 31.20 L-20.60 35.40 L-21.40 40.80 L-22.20 43.40 L-24.00 46.80 L-24.40 48.40 L-24.80 49.00 L-25.60 53.20 L-25.40 65.40 L-25.60 65.60 L-25.80 74.20 L-27.40 80.00 L-27.40 80.60 L-26.80 82.00 L-27.00 83.00 L-27.20 83.80 L-28.40 85.60 L-28.40 86.20 L-27.60 87.20 L-21.20 87.60 L21.40 87.60 L27.60 87.20 L28.40 86.20 L28.40 85.60 L27.20 83.80 L27.00 83.00 L26.80 82.00 L27.40 80.60 L27.40 80.00 L25.80 74.20 L25.60 65.60 L25.40 65.40 L25.60 53.20 L24.80 49.00 L24.40 48.40 L24.00 46.80 L22.20 43.40 L21.40 40.80 L20.60 35.40 L20.60 33.60 L20.40 33.40 L20.60 22.80 L20.80 22.60 L20.60 10.60 L19.80 5.40 L18.20 -1.20 L17.60 -10.80 L51.80 -11.00 L52.20 -11.20 L52.20 -11.60 L51.60 -13.60 L51.40 -15.80 L50.40 -18.20 L47.80 -22.80 L45.00 -26.20 L44.80 -26.80 L41.60 -31.20 L38.40 -34.80 L32.20 -40.80 L30.80 -43.00 L29.00 -44.80 L23.80 -53.60 L19.80 -57.60 L16.60 -58.60 L9.20 -58.80 L6.40 -60.20 L5.80 -60.80 L4.80 -63.60 L4.80 -65.60 L6.00 -67.60 L6.80 -69.80 L7.80 -70.20 L9.20 -73.80 L9.20 -75.00 L7.60 -75.60 L8.00 -78.40 L7.80 -80.80 L7.40 -82.20 L5.80 -85.20 L3.00 -87.20 L0.80 -87.60 Z'
// The outer projected raster contour bridges the two legs near the feet.
// Subtract a gently widening inner-leg opening, leaving the authentic CC0
// MakeHuman projected exterior untouched. The gap extends past the feet.
const INNER_LEG_GAP = 'M 0 24 C -2.8 29 -4.2 40 -5.4 53 C -6.3 65 -6.7 76 -7.4 91 L 7.4 91 C 6.7 76 6.3 65 5.4 53 C 4.2 40 2.8 29 0 24 Z'

export default function ClothCraftStudioSilhouette() {
 return <g className="cc-studio-avatar" pointerEvents="none" aria-label="CC0 MakeHuman front mesh silhouette">
  <path d={`${MESH_OUTLINE} ${INNER_LEG_GAP}`} fillRule="evenodd" fill="#91999c" stroke="#68747a" strokeWidth=".35" strokeLinejoin="round"/>
 </g>
}
