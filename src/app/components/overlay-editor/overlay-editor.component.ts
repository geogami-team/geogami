import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  NgZone,
  ChangeDetectorRef,
  Optional
} from '@angular/core';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { OverlayConfig, OverlayObject, ObjectRect } from '../../models/overlay-config.model';

interface DrawingRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

@Component({
  selector: 'app-overlay-editor',
  templateUrl: './overlay-editor.component.html',
  styleUrls: ['./overlay-editor.component.scss']
})
export class OverlayEditorComponent implements OnInit, OnDestroy, AfterViewInit {

  /**
   * Path or URL to the image to annotate.
   */
  @Input() imageUrl = '';

  /**
   * Optional: pre-existing config to load for editing.
   */
  @Input() existingConfig: OverlayConfig | null = null;

  /**
   * Mapbox image source coordinates (pass through to config output).
   */
  @Input() mapCoordinates: number[][] = [];

  /**
   * Emitted when the user saves. Contains the full OverlayConfig JSON.
   */
  @Output() configSaved = new EventEmitter<OverlayConfig>();

  /**
   * Emitted when the user taps cancel/close.
   */
  @Output() editorClosed = new EventEmitter<void>();

  @ViewChild('editorCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('imageContainer', { static: false }) containerRef!: ElementRef<HTMLDivElement>;

  objects: OverlayObject[] = [];
  selectedObjectId: string | null = null;
  isDrawing = false;
  editingLabelId: string | null = null;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private image!: HTMLImageElement;
  private imageLoaded = false;
  private currentDrawing: DrawingRect | null = null;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private nextId = 1;

  // For touch/mouse tracking
  private pointerDown = false;
  private hasMoved = false;

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    @Optional() private modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    if (this.existingConfig) {
      this.objects = [...this.existingConfig.objects];
      this.imageUrl = this.existingConfig.imageUrl || this.imageUrl;
      this.mapCoordinates = this.existingConfig.coordinates || this.mapCoordinates;
      // Set nextId to avoid collisions
      const maxNum = this.objects.reduce((max, obj) => {
        const num = parseInt(obj.id.replace(/\D/g, ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      this.nextId = maxNum + 1;
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  ngAfterViewInit(): void {
    // Small delay to ensure Ionic has rendered the view
    setTimeout(() => this.onCanvasReady(), 100);
  }

  // ─── Lifecycle & Setup ──────────────────────────────────────

  onCanvasReady(): void {
    if (!this.canvasRef || !this.containerRef) { return; }

    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    this.loadImage();
  }

  private loadImage(): void {
    this.image = new Image();
    this.image.crossOrigin = 'anonymous';
    this.image.onload = () => {
      this.imageLoaded = true;
      this.fitCanvasToContainer();
      this.redraw();
      this.cdr.detectChanges();
    };
    this.image.onerror = () => {
      console.error('Failed to load image:', this.imageUrl);
    };
    this.image.src = this.imageUrl;
  }

  private fitCanvasToContainer(): void {
    if (!this.containerRef) { return; }

    const container = this.containerRef.nativeElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || 500;

    // Scale image to fit container while maintaining aspect ratio
    const imgAspect = this.image.width / this.image.height;
    const containerAspect = containerWidth / containerHeight;

    if (imgAspect > containerAspect) {
      this.scale = containerWidth / this.image.width;
    } else {
      this.scale = containerHeight / this.image.height;
    }

    this.canvas.width = Math.floor(this.image.width * this.scale);
    this.canvas.height = Math.floor(this.image.height * this.scale);

    this.offsetX = Math.max(0, (containerWidth - this.canvas.width) / 2);
    this.offsetY = 0;
  }

  // ─── Drawing ──────────────────────────────────────────────────

  private redraw(): void {
    if (!this.ctx || !this.imageLoaded) { return; }

    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(this.image, 0, 0, w, h);

    // Draw existing object rectangles
    for (const obj of this.objects) {
      const isSelected = obj.id === this.selectedObjectId;
      this.drawObjectRect(obj, isSelected);
    }

    // Draw current drag rectangle
    if (this.currentDrawing) {
      this.ctx.strokeStyle = '#00e5ff';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 3]);
      const rx = Math.min(this.currentDrawing.startX, this.currentDrawing.endX);
      const ry = Math.min(this.currentDrawing.startY, this.currentDrawing.endY);
      const rw = Math.abs(this.currentDrawing.endX - this.currentDrawing.startX);
      const rh = Math.abs(this.currentDrawing.endY - this.currentDrawing.startY);
      this.ctx.strokeRect(rx, ry, rw, rh);
      this.ctx.setLineDash([]);
    }
  }

  private drawObjectRect(obj: OverlayObject, selected: boolean): void {
    const { x, y, w, h } = obj.rect;
    const sx = x * this.scale;
    const sy = y * this.scale;
    const sw = w * this.scale;
    const sh = h * this.scale;

    // Fill
    this.ctx.fillStyle = selected
      ? 'rgba(0, 229, 255, 0.15)'
      : 'rgba(255, 193, 7, 0.10)';
    this.ctx.fillRect(sx, sy, sw, sh);

    // Border
    this.ctx.strokeStyle = selected ? '#00e5ff' : '#ffc107';
    this.ctx.lineWidth = selected ? 2.5 : 1.5;
    this.ctx.setLineDash([]);
    this.ctx.strokeRect(sx, sy, sw, sh);

    // Label background
    const label = obj.label || obj.id;
    this.ctx.font = 'bold ' + Math.max(11, 13 * this.scale) + 'px sans-serif';
    const textMetrics = this.ctx.measureText(label);
    const textH = 18 * this.scale;
    const padding = 4 * this.scale;

    this.ctx.fillStyle = selected ? 'rgba(0, 229, 255, 0.85)' : 'rgba(255, 193, 7, 0.85)';
    this.ctx.fillRect(sx, sy - textH - 2, textMetrics.width + padding * 2, textH);

    // Label text
    this.ctx.fillStyle = '#000';
    this.ctx.fillText(label, sx + padding, sy - 6);
  }

  // ─── Pointer Events (unified mouse + touch) ──────────────────

  onPointerDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    const pos = this.getPointerPosition(event);
    if (!pos) { return; }

    this.pointerDown = true;
    this.hasMoved = false;

    // Check if clicking an existing object
    const clickedObj = this.findObjectAtPosition(pos.x, pos.y);

    if (clickedObj) {
      this.selectedObjectId = clickedObj.id;
      this.redraw();
      this.cdr.detectChanges();
      return;
    }

    // Start drawing a new rectangle
    this.selectedObjectId = null;
    this.isDrawing = true;
    this.currentDrawing = {
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y
    };
    this.cdr.detectChanges();
  }

  onPointerMove(event: MouseEvent | TouchEvent): void {
    if (!this.pointerDown || !this.isDrawing || !this.currentDrawing) { return; }
    event.preventDefault();

    const pos = this.getPointerPosition(event);
    if (!pos) { return; }

    this.hasMoved = true;
    this.currentDrawing.endX = pos.x;
    this.currentDrawing.endY = pos.y;

    this.ngZone.runOutsideAngular(() => this.redraw());
  }

  onPointerUp(event: MouseEvent | TouchEvent): void {
    if (!this.pointerDown) { return; }
    this.pointerDown = false;

    if (this.isDrawing && this.currentDrawing && this.hasMoved) {
      const rect = this.normalizeDrawingToImageCoords(this.currentDrawing);

      // Only create if the rectangle is big enough (at least 10x10 image pixels)
      if (rect.w >= 10 && rect.h >= 10) {
        this.promptForObjectId(rect);
      }
    }

    this.isDrawing = false;
    this.currentDrawing = null;
    this.redraw();
  }

  private getPointerPosition(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    const canvasRect = this.canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ((event as TouchEvent).changedTouches && (event as TouchEvent).changedTouches.length > 0) {
      clientX = (event as TouchEvent).changedTouches[0].clientX;
      clientY = (event as TouchEvent).changedTouches[0].clientY;
    } else {
      return null;
    }

    return {
      x: clientX - canvasRect.left,
      y: clientY - canvasRect.top
    };
  }

  private findObjectAtPosition(x: number, y: number): OverlayObject | null {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const sx = obj.rect.x * this.scale;
      const sy = obj.rect.y * this.scale;
      const sw = obj.rect.w * this.scale;
      const sh = obj.rect.h * this.scale;

      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return obj;
      }
    }
    return null;
  }

  /**
   * Convert the drawn rectangle (in canvas/screen coords) back to
   * actual image pixel coordinates.
   */
  private normalizeDrawingToImageCoords(drawing: DrawingRect): ObjectRect {
    const x1 = Math.min(drawing.startX, drawing.endX) / this.scale;
    const y1 = Math.min(drawing.startY, drawing.endY) / this.scale;
    const x2 = Math.max(drawing.startX, drawing.endX) / this.scale;
    const y2 = Math.max(drawing.startY, drawing.endY) / this.scale;

    return {
      x: Math.round(Math.max(0, x1)),
      y: Math.round(Math.max(0, y1)),
      w: Math.round(Math.min(x2 - x1, this.image.width - x1)),
      h: Math.round(Math.min(y2 - y1, this.image.height - y1))
    };
  }

  // ─── Object Management ────────────────────────────────────────

  async promptForObjectId(rect: ObjectRect): Promise<void> {
    const defaultId = 'object_' + this.nextId;

    const alert = await this.alertCtrl.create({
      header: 'Name This Object',
      message: 'Region: (' + rect.x + ', ' + rect.y + ') ' + rect.w + '\u00D7' + rect.h + 'px',
      inputs: [
        {
          name: 'objectId',
          type: 'text',
          placeholder: 'e.g. bear, tree_01, building',
          value: defaultId
        },
        {
          name: 'objectLabel',
          type: 'text',
          placeholder: 'Display label (optional)'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Add',
          handler: (data) => {
            const id = (data.objectId || defaultId).trim().replace(/\s+/g, '_');

            if (this.objects.find(o => o.id === id)) {
              this.showToast('Object "' + id + '" already exists. Use a different ID.', 'warning');
              return false;
            }

            const newObj: OverlayObject = {
              id,
              label: data.objectLabel?.trim() || undefined,
              rect
            };

            this.objects.push(newObj);
            this.selectedObjectId = id;
            this.nextId++;
            this.redraw();
            this.cdr.detectChanges();
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  selectObject(id: string): void {
    this.selectedObjectId = this.selectedObjectId === id ? null : id;
    this.redraw();
  }

  async deleteObject(id: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Object',
      message: 'Remove "' + id + '" from the config?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.objects = this.objects.filter(o => o.id !== id);
            if (this.selectedObjectId === id) {
              this.selectedObjectId = null;
            }
            this.redraw();
            this.cdr.detectChanges();
          }
        }
      ]
    });
    await alert.present();
  }

  async renameObject(obj: OverlayObject): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Rename Object',
      inputs: [
        {
          name: 'newId',
          type: 'text',
          value: obj.id,
          placeholder: 'Object ID'
        },
        {
          name: 'newLabel',
          type: 'text',
          value: obj.label || '',
          placeholder: 'Display label (optional)'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            const newId = (data.newId || obj.id).trim().replace(/\s+/g, '_');

            if (newId !== obj.id && this.objects.find(o => o.id === newId)) {
              this.showToast('Object "' + newId + '" already exists.', 'warning');
              return false;
            }

            obj.id = newId;
            obj.label = data.newLabel?.trim() || undefined;
            this.redraw();
            this.cdr.detectChanges();
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  deleteAllObjects(): void {
    this.objects = [];
    this.selectedObjectId = null;
    this.nextId = 1;
    this.redraw();
  }

  // ─── Config Output ────────────────────────────────────────────

  buildConfig(): OverlayConfig {
    return {
      imageUrl: this.imageUrl,
      coordinates: this.mapCoordinates,
      objects: this.objects.map(o => {
        const entry: OverlayObject = {
          id: o.id,
          rect: { ...o.rect }
        };
        if (o.label) {
          entry.label = o.label;
        }
        return entry;
      })
    };
  }

  getConfigJson(): string {
    return JSON.stringify(this.buildConfig(), null, 2);
  }

  async saveConfig(): Promise<void> {
    if (this.objects.length === 0) {
      this.showToast('No objects defined yet. Draw rectangles on the image first.', 'warning');
      return;
    }

    const config = this.buildConfig();
    this.configSaved.emit(config);
    this.showToast('Config saved with ' + this.objects.length + ' object(s).', 'success');

    // If used as a modal, dismiss with the config
    if (this.modalCtrl) {
      await this.modalCtrl.dismiss({ config });
    }
  }

  async copyConfigToClipboard(): Promise<void> {
    const json = this.getConfigJson();
    try {
      await navigator.clipboard.writeText(json);
      this.showToast('Config JSON copied to clipboard!', 'success');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = json;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('Config JSON copied to clipboard!', 'success');
    }
  }

  close(): void {
    if (this.modalCtrl) {
      this.modalCtrl.dismiss();
    }
    this.editorClosed.emit();
  }

  // ─── Utilities ────────────────────────────────────────────────

  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  trackById(_index: number, obj: OverlayObject): string {
    return obj.id;
  }
}