/** Recolour only the basemap; labels, markers and map controls remain independent. */
export function tintUaeMapPixels(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (pixels[i + 3] === 0) continue;
    const light = r * .299 + g * .587 + b * .114;
    // Preserve dark street names, outlines and text contrast.
    if (light < 110) continue;
    if (b > r + 10 && g > r + 4 && b > 140) {
      const shade = (light - 195) * .55;
      pixels[i] = 99 + shade; pixels[i + 1] = 181 + shade; pixels[i + 2] = 218 + shade * .65;
    } else if (r > g + 18 && g > b + 3) {
      const shade = (light - 160) * .65;
      pixels[i] = 218 + shade; pixels[i + 1] = 178 + shade; pixels[i + 2] = 97 + shade;
    } else if (g > r + 4 && g > b + 8) {
      const shade = (light - 200) * .65;
      pixels[i] = 211 + shade; pixels[i + 1] = 225 + shade; pixels[i + 2] = 187 + shade;
    } else if (r >= g - 8 && g > b + 5 && Math.min(r, g) > 160) {
      const shade = (light - 225) * .65;
      pixels[i] = 245 + shade; pixels[i + 1] = 233 + shade; pixels[i + 2] = 205 + shade;
    }
  }
  return pixels;
}
