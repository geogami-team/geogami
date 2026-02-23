/**
 * Overlay Config Model
 * Defines the structure for image overlay configurations.
 * Each image has a list of objects with bounding boxes that can be toggled.
 *
 * Compatible with Angular 12+
 */

export interface ObjectRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OverlayObject {
  id: string;
  label?: string;        // Human-readable name (falls back to id)
  rect: ObjectRect;
}

export interface OverlayConfig {
  imageUrl: string;
  coordinates: number[][];  // Mapbox image source coordinates [topLeft, topRight, bottomRight, bottomLeft]
  objects: OverlayObject[];
}
