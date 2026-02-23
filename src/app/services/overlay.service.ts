import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import mapboxgl from 'mapbox-gl';
import { OverlayConfig, OverlayObject } from '../models/overlay-config.model';

/**
 * OverlayService
 *
 * A reusable service that loads an image overlay on a Mapbox map
 * and allows dynamic hiding/showing of objects defined by bounding boxes.
 *
 * Works with any image and any background color — uses edge-sampling
 * to detect and fill the correct background when hiding objects.
 *
 * Compatible with Angular 12+ / RxJS 6.x / Ionic 7.1.1
 *
 * Usage:
 *   await overlayService.loadOverlay(map, 'assets/configs/VirEnv_43.objects.json');
 *   overlayService.hideObjects(['bear', 'tiger']);
 *   overlayService.showObject('bear');
 *   overlayService.toggleObject('deer');
 */
@Injectable({ providedIn: 'root' })
export class OverlayService {

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private baseImage!: HTMLImageElement;
  private bgPatches: Map<string, ImageData> = new Map();
  private hiddenObjects: Set<string> = new Set();
  private config!: OverlayConfig;
  private map!: mapboxgl.Map;

  private readonly sourceId = 'dynamic-overlay';
  private readonly layerId = 'dynamic-overlay-layer';

  constructor(private http: HttpClient) {}

  // ─── Public API ───────────────────────────────────────────────

  /**
   * Load an overlay config and add the canvas-based image layer to the map.
   * Can be called multiple times to switch images — cleans up previous overlay.
   */
  async loadOverlay(map: mapboxgl.Map, configOrUrl: string | OverlayConfig): Promise<void> {
    this.map = map;
    this.hiddenObjects.clear();
    this.bgPatches.clear();

    // Accept either a URL string or a config object directly
    if (typeof configOrUrl === 'string') {
      // .toPromise() works with RxJS 6.x (Angular 12)
      this.config = await this.http.get<OverlayConfig>(configOrUrl).toPromise() as OverlayConfig;
    } else {
      this.config = configOrUrl;
    }

    // Remove previous overlay if switching images
    this.removeOverlay();

    // Load the image and set up the canvas
    await this.loadBaseImage(this.config.imageUrl);
    this.captureBackgroundPatches();
    this.redraw();

    // Add canvas source to Mapbox
    (map as any).addSource(this.sourceId, {
      type: 'canvas',
      canvas: this.canvas,
      coordinates: this.config.coordinates,
      animate: true
    });

    map.addLayer({
      id: this.layerId,
      source: this.sourceId,
      type: 'raster',
      paint: { 'raster-opacity': 0.85 }
    });
  }

  /**
   * Remove the overlay from the map entirely.
   */
  removeOverlay(): void {
    if (this.map) {
      if (this.map.getLayer(this.layerId)) {
        this.map.removeLayer(this.layerId);
      }
      if (this.map.getSource(this.sourceId)) {
        this.map.removeSource(this.sourceId);
      }
    }
  }

  /**
   * Hide a single object by ID.
   */
  hideObject(id: string): void {
    this.hiddenObjects.add(id);
    this.redraw();
  }

  /**
   * Show a single object by ID.
   */
  showObject(id: string): void {
    this.hiddenObjects.delete(id);
    this.redraw();
  }

  /**
   * Toggle a single object's visibility.
   */
  toggleObject(id: string): void {
    if (this.hiddenObjects.has(id)) {
      this.showObject(id);
    } else {
      this.hideObject(id);
    }
  }

  /**
   * Hide multiple objects at once.
   * Pass an array of object IDs to hide.
   * Objects not in the list remain unchanged.
   */
  hideObjects(ids: string[]): void {
    ids.forEach(id => this.hiddenObjects.add(id));
    this.redraw();
  }

  /**
   * Show multiple objects at once.
   */
  showObjects(ids: string[]): void {
    ids.forEach(id => this.hiddenObjects.delete(id));
    this.redraw();
  }

  /**
   * Set exactly which objects should be hidden.
   * All objects NOT in this list will be shown.
   */
  setHiddenObjects(ids: string[]): void {
    this.hiddenObjects.clear();
    ids.forEach(id => this.hiddenObjects.add(id));
    this.redraw();
  }

  /**
   * Show all objects (reset).
   */
  showAll(): void {
    this.hiddenObjects.clear();
    this.redraw();
  }

  /**
   * Hide all objects.
   */
  hideAll(): void {
    this.config.objects.forEach(obj => this.hiddenObjects.add(obj.id));
    this.redraw();
  }

  /**
   * Get the list of configured objects.
   */
  getObjects(): OverlayObject[] {
    return this.config?.objects ?? [];
  }

  /**
   * Check if an object is currently hidden.
   */
  isHidden(id: string): boolean {
    return this.hiddenObjects.has(id);
  }

  /**
   * Get all currently hidden object IDs.
   */
  getHiddenIds(): string[] {
    return Array.from(this.hiddenObjects);
  }

  /**
   * Get the current config (useful for saving editor results).
   */
  getConfig(): OverlayConfig | null {
    return this.config ?? null;
  }

  // ─── Internal ─────────────────────────────────────────────────

  private loadBaseImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.baseImage = new Image();
      this.baseImage.crossOrigin = 'anonymous';
      this.baseImage.onload = () => {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.baseImage.width;
        this.canvas.height = this.baseImage.height;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        resolve();
      };
      this.baseImage.onerror = () => reject(new Error('Failed to load image: ' + url));
      this.baseImage.src = url;
    });
  }

  /**
   * Before any hiding, sample the background color around each object
   * and store a solid fill patch. Works for any background color.
   */
  private captureBackgroundPatches(): void {
    this.ctx.drawImage(this.baseImage, 0, 0);

    for (const obj of this.config.objects) {
      const { x, y, w, h } = obj.rect;
      const bgColor = this.sampleBackgroundColor(x, y, w, h);

      const patch = this.ctx.createImageData(w, h);
      for (let i = 0; i < patch.data.length; i += 4) {
        patch.data[i]     = bgColor.r;
        patch.data[i + 1] = bgColor.g;
        patch.data[i + 2] = bgColor.b;
        patch.data[i + 3] = bgColor.a;
      }
      this.bgPatches.set(obj.id, patch);
    }
  }

  /**
   * Sample pixels along the edges outside the bounding box
   * to determine the dominant background color via median.
   */
  private sampleBackgroundColor(
    x: number, y: number, w: number, h: number
  ): { r: number; g: number; b: number; a: number } {
    const samples: number[][] = [];
    const margin = 4;
    const step = 4;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Top edge
    for (let sx = x; sx < x + w; sx += step) {
      if (y - margin >= 0) {
        const px = this.ctx.getImageData(sx, y - margin, 1, 1).data;
        samples.push([px[0], px[1], px[2], px[3]]);
      }
    }
    // Bottom edge
    for (let sx = x; sx < x + w; sx += step) {
      if (y + h + margin < ch) {
        const px = this.ctx.getImageData(sx, y + h + margin, 1, 1).data;
        samples.push([px[0], px[1], px[2], px[3]]);
      }
    }
    // Left edge
    for (let sy = y; sy < y + h; sy += step) {
      if (x - margin >= 0) {
        const px = this.ctx.getImageData(x - margin, sy, 1, 1).data;
        samples.push([px[0], px[1], px[2], px[3]]);
      }
    }
    // Right edge
    for (let sy = y; sy < y + h; sy += step) {
      if (x + w + margin < cw) {
        const px = this.ctx.getImageData(x + w + margin, sy, 1, 1).data;
        samples.push([px[0], px[1], px[2], px[3]]);
      }
    }

    if (samples.length === 0) {
      return { r: 255, g: 255, b: 255, a: 255 }; // fallback white
    }

    // Use median for robustness against outliers
    const median = (arr: number[]): number => {
      const sorted = arr.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };

    return {
      r: median(samples.map(s => s[0])),
      g: median(samples.map(s => s[1])),
      b: median(samples.map(s => s[2])),
      a: median(samples.map(s => s[3]))
    };
  }

  /**
   * Redraw the canvas: full base image, then paint over hidden objects.
   */
  private redraw(): void {
    if (!this.ctx || !this.baseImage) { return; }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.baseImage, 0, 0);

    this.hiddenObjects.forEach(id => {
      const obj = this.config.objects.find(o => o.id === id);
      const patch = this.bgPatches.get(id);
      if (obj && patch) {
        this.ctx.putImageData(patch, obj.rect.x, obj.rect.y);
      }
    });
  }
}