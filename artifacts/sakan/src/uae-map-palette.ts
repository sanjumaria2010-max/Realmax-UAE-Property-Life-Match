/** A restrained Realmax palette: ocean blue water, blue land, pale roads and labels. */
export function tintUaeMapPixels(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (pixels[i + 3] === 0) continue;
    const light = r * .299 + g * .587 + b * .114;
    if (light < 110) {
      // Invert dark lettering into light blue-white, keeping it legible on navy.
      const strength = (110 - light) / 110;
      pixels[i] = 93 + strength * 111;
      pixels[i + 1] = 136 + strength * 87;
      pixels[i + 2] = 161 + strength * 73;
    } else if (b > r + 10 && g > r + 4 && b > 140) {
      const shade = (light - 195) * .08;
      pixels[i] = 4 + shade; pixels[i + 1] = 34 + shade; pixels[i + 2] = 54 + shade;
    } else if (r > g + 18 && g > b + 3) {
      // Major roads get one muted blue highlight, never gold or orange.
      const shade = (light - 160) * -.18;
      pixels[i] = 68 + shade; pixels[i + 1] = 112 + shade; pixels[i + 2] = 139 + shade;
    } else if (r >= g - 8 && g > b + 5 && Math.min(r, g) > 160) {
      const shade = (light - 225) * .12;
      pixels[i] = 18 + shade; pixels[i + 1] = 62 + shade; pixels[i + 2] = 85 + shade;
    } else {
      // Neutral streets and parks share the blue family rather than adding colours.
      const shade = (255 - light) * .14;
      pixels[i] = 34 + shade; pixels[i + 1] = 77 + shade; pixels[i + 2] = 100 + shade;
    }
  }
  return pixels;
}
