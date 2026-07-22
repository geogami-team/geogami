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
  referenced: boolean | null; // null = not yet known (still enriching)
  refCount: number;
  hosts: string[];
  hostFlag: boolean;
  games: GameRef[];
  pending?: boolean; // true while reference/game info is still loading
}

interface CategoryMeta {
  bucket: string;
  kind: string | null;
  label: string;
  totalFiles: number;
  totalBytes: number | null;
  referencedFiles: number | null;
  orphanFiles: number | null;
  hostFlaggedFiles: number | null;
}

const PAGE_SIZE = 20;
// Max pages auto-loaded to surface matches for a sparse reference filter.
const AUTO_FILL_MAX_PAGES = 40;

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

  loading = true; // initial / full reload spinner (fast file list)
  error = "";

  // Reference/host/game info arrives after the file list (background scan).
  summaryReady = false;
  summaryLoading = false;
  // True once at least one loaded view exists — enables "Cancel" on the
  // selection screen so it can be dismissed without re-loading.
  hasLoadedOnce = false;

  generatedAt: string | null = null;
  canonicalHost = "";
  hosts: { host: string; count: number; canonical: boolean }[] = [];
  totals: {
    files: number;
    bytes: number;
    referenced: number;
    orphans: number;
    hostFlagged: number;
  } | null = null;
  categories: CategoryMeta[] = [];

  activeBucket = "";

  // Guards the background scan for the current view so pages loaded before it
  // finishes are re-enriched once it does.
  private enrichToken = 0;
  private loadingMore = false;
  // When a reference filter is active and matches are sparse, we auto-load more
  // pages to surface them — bounded so a rare filter can't fetch the whole DB.
  private autoFillBudget = 0;

  // List vs. grid (bigger thumbnails) view.
  viewMode: "list" | "grid" = "list";
  // File shown full-size in the lightbox overlay (grid clicks / preview).
  lightboxFile: MediaFile | null = null;

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

  // Confirm the selection → load the chosen categories.
  startLoading() {
    if (!this.anySelected) return;
    this.selecting = false;
    this.activeBucket = "";
    this.files = [];
    this.summaryReady = false;
    this.reload();
  }

  // Open the selection screen (keeps current results in memory).
  changeSelection() {
    this.selecting = true;
  }

  // Dismiss the selection screen back to the existing results (no reload).
  cancelSelection() {
    if (this.hasLoadedOnce) this.selecting = false;
  }

  get refFilterActive(): boolean {
    return this.onlyHostFlagged || this.onlyOrphans;
  }

  // Rows to display: the loaded files, filtered client-side by the reference
  // toggles (instant — no reload). Files still being enriched (pending) can't
  // be classified yet, so they're hidden while a reference filter is active.
  get displayFiles(): MediaFile[] {
    if (!this.refFilterActive) return this.files;
    return this.files.filter((f) => {
      if (f.pending) return false;
      if (this.onlyHostFlagged && !f.hostFlag) return false;
      if (this.onlyOrphans && f.referenced) return false;
      return true;
    });
  }

  // Segments come from the selection immediately (counts known); the reference
  // sub-counts (referenced / orphan / flagged) fill in after the scan.
  private buildSegmentsFromSelection() {
    this.categories = this.selectableCategories
      .filter((c) => c.selected)
      .map((c) => ({
        bucket: c.bucket,
        kind: c.kind,
        label: c.label,
        totalFiles: c.totalFiles,
        totalBytes: null,
        referencedFiles: null,
        orphanFiles: null,
        hostFlaggedFiles: null,
      }));
    if (
      !this.activeBucket ||
      !this.categories.some((c) => c.bucket === this.activeBucket)
    ) {
      this.activeBucket = this.categories.length ? this.categories[0].bucket : "";
    }
  }

  // Full reload: reset to page 0 for the active bucket + current search.
  // Always uses the fast path (file list first, references enriched after);
  // reference toggles are applied client-side, never via a reload.
  async reload(refresh = false) {
    this.loading = true;
    this.error = "";
    this.previewFilename = null;
    this.lightboxFile = null;
    this.page = 0;
    this.summaryReady = false;
    this.autoFillBudget = AUTO_FILL_MAX_PAGES;
    const token = ++this.enrichToken;
    this.buildSegmentsFromSelection();

    try {
      const res = await this.fetchFilesOnly(0);
      if (token !== this.enrichToken) return;
      this.files = res.page.files;
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
      this.loading = false;
      this.hasLoadedOnce = true;
      this.enrichPage(0, token, refresh);
    } catch (e) {
      this.error =
        (e && e.error && e.error.error) ||
        "Could not load the media audit. Admin access is required.";
    } finally {
      this.loading = false;
    }
  }

  // Infinite-scroll handler.
  async loadMore(ev: any) {
    await this.loadNextPage();
    ev.target.complete();
  }

  // Append the next page (fast list), then enrich it in the background.
  private async loadNextPage(): Promise<void> {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    const token = this.enrichToken;
    try {
      const next = this.page + 1;
      const res = await this.fetchFilesOnly(next);
      if (token !== this.enrichToken) return;
      this.files = this.files.concat(res.page.files);
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
      this.page = next;
      this.enrichPage(next, token);
    } catch (_) {
      this.hasMore = false;
    } finally {
      this.loadingMore = false;
    }
  }

  // Background: fetch the reference/host/game info for one page and merge it
  // into the already-displayed rows, then top up sparse filtered views.
  private async enrichPage(page: number, token: number, refresh = false) {
    this.summaryLoading = true;
    try {
      const res = await this.fetchFull(page, refresh);
      if (token !== this.enrichToken) return;
      this.mergeRef(res.page.files);
      this.applySummary(res);
      this.summaryReady = true;
      this.maybeAutoFill(token);
    } catch (_) {
      // leave rows pending; a later Refresh can retry
    } finally {
      if (token === this.enrichToken) this.summaryLoading = false;
    }
  }

  // When a reference filter is active but few matches are loaded, pull the next
  // page so matches keep appearing without the user having to scroll a short
  // list. Bounded by autoFillBudget so a sparse filter can't fetch everything.
  private maybeAutoFill(token: number) {
    if (token !== this.enrichToken) return;
    if (!this.refFilterActive) return;
    if (this.loading || this.loadingMore || !this.hasMore) return;
    if (this.displayFiles.length >= PAGE_SIZE) return;
    if (this.autoFillBudget <= 0) return;
    this.autoFillBudget--;
    this.loadNextPage();
  }

  // Copy reference/host/game fields onto matching rows (by filename).
  private mergeRef(enriched: MediaFile[]) {
    const map = new Map(enriched.map((f) => [f.filename, f]));
    for (const f of this.files) {
      const e = map.get(f.filename);
      if (e) {
        f.referenced = e.referenced;
        f.refCount = e.refCount;
        f.hosts = e.hosts;
        f.hostFlag = e.hostFlag;
        f.games = e.games;
        f.pending = false;
      }
    }
  }

  private fetchFilesOnly(page: number): Promise<any> {
    return this.authService.GetMediaAudit({
      filesOnly: true,
      bucket: this.activeBucket || undefined,
      page,
      limit: PAGE_SIZE,
      q: this.search.trim() || undefined,
    });
  }

  // No reference filters here: this must paginate identically to fetchFilesOnly
  // so page N carries the reference data for the same 20 files. The reference
  // toggles are applied client-side (see displayFiles).
  private fetchFull(page: number, refresh = false): Promise<any> {
    return this.authService.GetMediaAudit({
      kinds: this.selectedKindsCsv || undefined,
      bucket: this.activeBucket || undefined,
      page,
      limit: PAGE_SIZE,
      q: this.search.trim() || undefined,
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

  private applySummary(res: any) {
    this.generatedAt = res.generatedAt;
    this.canonicalHost = res.canonicalHost;
    this.hosts = res.hosts || [];
    this.totals = res.totals;
    if (res.categories && res.categories.length) this.categories = res.categories;
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

  // Text search changes the server-side file query → reset to page 0.
  onSearchChange() {
    this.reload();
  }

  // Reference toggles are client-side only (no reload) — just top up if sparse.
  onRefFilterChange() {
    this.autoFillBudget = AUTO_FILL_MAX_PAGES;
    this.maybeAutoFill(this.enrichToken);
  }

  setViewMode(ev: any) {
    this.viewMode = ev.detail.value;
  }

  openLightbox(f: MediaFile) {
    if (f.path) this.lightboxFile = f;
  }
  closeLightbox() {
    this.lightboxFile = null;
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
