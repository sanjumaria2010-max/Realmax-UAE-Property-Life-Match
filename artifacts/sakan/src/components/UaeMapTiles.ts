import L from 'leaflet';
import { tintUaeMapPixels } from '../uae-map-palette';

/** Standard georeferenced tiles, rendered in Realmax's blue-and-white prototype palette. */
export class UaeMapTiles extends L.TileLayer {
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement('canvas');
    const size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.setAttribute('role', 'presentation');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Map rendering is unavailable in this browser.');
        context.drawImage(image, 0, 0, size.x, size.y);
        const bitmap = context.getImageData(0, 0, size.x, size.y);
        tintUaeMapPixels(bitmap.data);
        context.putImageData(bitmap, 0, 0);
        done(undefined, canvas);
      } catch (error) {
        done(error instanceof Error ? error : new Error('Map styling could not load.'), canvas);
      }
    };
    image.onerror = () => done(new Error('Map tiles could not load.'), canvas);
    image.src = this.getTileUrl(coords);
    return canvas;
  }
}
