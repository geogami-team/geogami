import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { AuthService } from "src/app/services/auth-service.service";
import { environment } from "src/environments/environment";

interface GameRef {
  id: string;
  name: string | null;
  viaTrack: boolean;
  count: number;
}

interface MediaFile {
  filename: string;
  path: string | null;
  size: number;
  uploadDate: string | null;
  contentType: string | null;
  referenced: boolean;
  refCount: number;
  hosts: string[];
  hostFlag: boolean;
  games: GameRef[];
}

interface CategoryMeta {
  bucket: string;
  kind: string | null;
  label: string;
  totalFiles: number;
  totalBytes: number;
  referencedFiles: number;
  orphanFiles: number;
  hostFlaggedFiles: number;
}

const PAGE_SIZE = 20;

@Component({
  selector: "app-media-audit",
  templateUrl: "./media-audit.page.html",
  styleUrls: ["./media-audit.page.scss"],
})
export class MediaAuditPage implements OnInit {
  // Selection screen: pick which categories to load before the heavy scan runs.
  selecting = true;
  metaLoading = true;
  metaError = "";
  selectableCategories: {
    bucket: string;
    kind: string | null;
    label: string;
    totalFiles: number;
    key: string; // kind || "other"
    selected: boolean;
  }[] = [];

  loading = true; // initial / full reload spinner
  error = "";

  generatedAt: string | null = null;
  canonicalHost = "";
  hosts: { host: string; count: number; canonical: boolean }[] = [];
  totals = { files: 0, bytes: 0, referenced: 0, orphans: 0, hostFlagged: 0 };
  categories: CategoryMeta[] = [];

  activeBucket = "";

  // Accumulated files for the current bucket + filters (grows via infinite scroll).
  files: MediaFile[] = [];
  page = 0;
  filteredTotal = 0;
  hasMore = false;

  // Filters (applied server-side).
  search = "";
  onlyHostFlagged = false;
  onlyOrphans = false;

  previewFilename: string | null = null;

  readonly apiURL = environment.apiURL;

  constructor(
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadCategories();
  }

  // Selection screen: fetch cheap per-category counts (no scan).
  async loadCategories() {
    this.selecting = true;
    this.metaLoading = true;
    this.metaError = "";
    try {
      const res = await this.authService.GetMediaCategories();
      this.selectableCategories = (res.categories || []).map((c: any) => ({
        bucket: c.bucket,
        kind: c.kind,
        label: c.label,
        totalFiles: c.totalFiles,
        key: c.kind || "other",
        selected: true,
      }));
    } catch (e) {
      this.metaError =
        (e && e.error && e.error.error) ||
        "Could not load media categories. Admin access is required.";
    } finally {
      this.metaLoading = false;
    }
  }

  get anySelected(): boolean {
    return this.selectableCategories.some((c) => c.selected);
  }

  private get selectedKindsCsv(): string {
    return this.selectableCategories
      .filter((c) => c.selected)
      .map((c) => c.key)
      .join(",");
  }

  // Confirm the selection → run the (heavy, cached) scan for those categories.
  startLoading() {
    if (!this.anySelected) return;
    this.selecting = false;
    this.activeBucket = "";
    this.files = [];
    this.reload();
  }

  // Back to the selection screen.
  changeSelection() {
    this.selecting = true;
  }

  // Full reload: reset to page 0 for the active bucket + current filters.
  async reload(refresh = false) {
    this.loading = true;
    this.error = "";
    this.previewFilename = null;
    this.page = 0;
    try {
      const res = await this.fetch(0, refresh);
      this.applyMeta(res);
      this.files = res.page.files;
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
      if (refresh) this.showToast("Media list refreshed.");
    } catch (e) {
      this.error =
        (e && e.error && e.error.error) ||
        "Could not load the media audit. Admin access is required.";
    } finally {
      this.loading = false;
    }
  }

  // Infinite-scroll handler: append the next page.
  async loadMore(ev: any) {
    if (!this.hasMore) {
      ev.target.complete();
      return;
    }
    try {
      const next = this.page + 1;
      const res = await this.fetch(next);
      this.page = next;
      this.files = this.files.concat(res.page.files);
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
      this.applyMeta(res); // keep counts fresh
    } catch (_) {
      // keep what we have; stop paging on error
      this.hasMore = false;
    } finally {
      ev.target.complete();
    }
  }

  private fetch(page: number, refresh = false): Promise<any> {
    return this.authService.GetMediaAudit({
      kinds: this.selectedKindsCsv || undefined,
      bucket: this.activeBucket || undefined,
      page,
      limit: PAGE_SIZE,
      q: this.search.trim() || undefined,
      hostFlagged: this.onlyHostFlagged,
      orphans: this.onlyOrphans,
      refresh,
    });
  }

  // Distinct game references for a file (deduped by name for display).
  gameLabel(f: MediaFile): string {
    if (!f.games || !f.games.length) return "";
    const names = f.games.map((g) => g.name || "(deleted game)");
    const unique = names.filter((n, i) => names.indexOf(n) === i);
    return unique.join(", ");
  }

  private applyMeta(res: any) {
    this.generatedAt = res.generatedAt;
    this.canonicalHost = res.canonicalHost;
    this.hosts = res.hosts || [];
    this.totals = res.totals;
    this.categories = res.categories || [];
    if (
      !this.activeBucket ||
      !this.categories.some((c) => c.bucket === this.activeBucket)
    ) {
      this.activeBucket = this.categories.length ? this.categories[0].bucket : "";
    }
  }

  get activeCategory(): CategoryMeta | undefined {
    return this.categories.find((c) => c.bucket === this.activeBucket);
  }

  segmentChanged(ev: any) {
    this.activeBucket = ev.detail.value;
    this.reload();
  }

  // Any filter change → reset to page 0.
  onFilterChange() {
    this.reload();
  }

  togglePreview(f: MediaFile) {
    if (!f.path) return;
    this.previewFilename = this.previewFilename === f.filename ? null : f.filename;
  }

  fullUrl(f: MediaFile): string {
    return f.path ? `${this.apiURL}${f.path}` : "";
  }

  isImage(f: MediaFile): boolean {
    return f.path ? f.path.startsWith("/file/image/") : false;
  }
  isAudio(f: MediaFile): boolean {
    return f.path ? f.path.startsWith("/file/audio/") : false;
  }
  isVideo(f: MediaFile): boolean {
    return f.path ? f.path.startsWith("/file/video/") : false;
  }

  fmtBytes(n: number): string {
    if (n == null) return "";
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let i = -1;
    do {
      n /= 1024;
      i++;
    } while (n >= 1024 && i < units.length - 1);
    return `${n.toFixed(2)} ${units[i]}`;
  }

  private async showToast(message: string) {
    const t = await this.toastController.create({ message, duration: 1800 });
    await t.present();
  }
}
