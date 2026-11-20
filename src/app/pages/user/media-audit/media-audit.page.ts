import { Component, OnDestroy, OnInit } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular";
import { AuthService, MediaCleanupJob, MediaCleanupResult, MediaOperationProgress } from "src/app/services/auth-service.service";
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
  referenced: boolean | null;
  refCount: number;
  hosts: string[];
  hostFlag: boolean;
  games: GameRef[];
}

interface InventoryCategory {
  bucket: string;
  kind: string | null;
  label: string;
  totalFiles: number;
  years?: { year: number; files: number }[];
}

interface CategoryMeta extends InventoryCategory {
  totalBytes: number;
  referencedFiles: number;
  orphanFiles: number;
  hostFlaggedFiles: number;
  eligibleFiles: number;
  pendingDeletes: number;
  deletable: boolean;
}

const PAGE_SIZE = 20;
const SCAN_POLL_MS = 2000;
const CLEANUP_POLL_MS = 1000;

@Component({
  selector: "app-media-audit",
  templateUrl: "./media-audit.page.html",
  styleUrls: ["./media-audit.page.scss"],
})
export class MediaAuditPage implements OnInit, OnDestroy {
  selecting = false;
  metaLoading = false;
  metaError = "";
  selectableCategories: { bucket: string; label: string; totalFiles: number; selected: boolean }[] = [];
  private inventory: InventoryCategory[] = [];
  private selectedBuckets: string[] = [];

  loading = true;
  scanProgress: MediaOperationProgress | null = null;
  previewing = false;
  deleting = false;
  cleanupProgress: MediaOperationProgress | null = null;
  cleanupPollingDelayed = false;
  error = "";
  generatedAt: string | null = null;
  canonicalHost = "";
  hosts: { host: string; count: number; canonical: boolean }[] = [];
  totals: { files: number; bytes: number; referenced: number; orphans: number; hostFlagged: number } | null = null;
  categories: CategoryMeta[] = [];
  activeBucket = "";
  years: number[] = [];
  year: number | null = null;

  private requestVersion = 0;
  private destroyed = false;
  private scanPoll?: ReturnType<typeof setTimeout>;
  private previewRequested = false;
  private loadingMore = false;
  private page = 0;
  files: MediaFile[] = [];
  filteredTotal = 0;
  hasMore = false;

  search = "";
  onlyHostFlagged = false;
  onlyOrphans = true;
  viewMode: "list" | "grid" = "list";
  lightboxFile: MediaFile | null = null;
  previewFilename: string | null = null;
  readonly apiURL = environment.apiURL;
  readonly searchPhases = ["references", "matching"];
  readonly cleanupPhases = ["references", "eligibility", "deleting", "finishing"];
  readonly progressLabels = {
    references: "Checking references",
    matching: "Matching references to uploaded files",
    eligibility: "Finding files eligible for deletion",
    deleting: "Deleting unreferenced files",
    finishing: "Saving the cleanup result",
  };
  readonly progressUnits = { references: "records checked", matching: "files checked", eligibility: "entries checked", deleting: "files deleted" };

  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadInventory();
    this.reload();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.requestVersion++;
    clearTimeout(this.scanPoll);
  }

  loadCategories() {
    this.selecting = true;
    this.loadInventory();
  }

  private async loadInventory() {
    if (this.metaLoading) return;
    this.metaLoading = true;
    this.metaError = "";
    try {
      const res = await this.authService.GetMediaCategories();
      this.inventory = res.categories || [];
      this.selectableCategories = this.inventory.map((c) => ({
        bucket: c.bucket,
        label: c.label,
        totalFiles: c.totalFiles,
        selected: !this.selectedBuckets.length || this.selectedBuckets.includes(c.bucket),
      }));
      if (this.loading) this.showInventory();
    } catch (err) {
      this.metaError = err?.error?.error || "Could not load media categories.";
    } finally {
      this.metaLoading = false;
    }
  }

  private setYears(available: number[]) {
    const years = new Set(available);
    if (this.year !== null) years.add(this.year);
    this.years = [...years].sort((a, b) => b - a);
  }

  private showInventory() {
    if (!this.inventory.length) return;
    const visible = this.inventory.filter((category) => !this.selectedBuckets.length || this.selectedBuckets.includes(category.bucket));
    this.categories = visible.map((category) => ({
      ...category,
      totalFiles: this.year === null ? category.totalFiles : category.years?.find(({ year }) => year === this.year)?.files || 0,
      totalBytes: null,
      referencedFiles: null,
      orphanFiles: null,
      hostFlaggedFiles: null,
      eligibleFiles: 0,
      pendingDeletes: 0,
      deletable: false,
    }));
    if (!this.activeCategory) this.activeBucket = visible[0]?.bucket || "";
    const years: number[] = [];
    for (const category of visible) years.push(...(category.years || []).map(({ year }) => year));
    this.setYears(years);
  }

  get anySelected(): boolean {
    return this.selectableCategories.some((category) => category.selected);
  }

  startLoading() {
    if (!this.anySelected) return;
    this.selectedBuckets = this.selectableCategories.filter((category) => category.selected).map((category) => category.bucket);
    this.selecting = false;
    this.reload();
  }

  cancelSelection() {
    this.selecting = false;
  }

  private fetchPage(page: number, refresh = false, filesOnly = false) {
    return this.authService.GetMediaAudit({
      buckets: this.selectedBuckets.join(","),
      bucket: this.activeBucket,
      year: this.year,
      page,
      limit: PAGE_SIZE,
      q: this.search.trim(),
      hostFlagged: !filesOnly && this.onlyHostFlagged,
      orphans: !filesOnly && this.onlyOrphans,
      refresh,
      filesOnly,
      defer: page === 0 && !filesOnly,
    });
  }

  async reload(refresh = false) {
    const version = ++this.requestVersion;
    clearTimeout(this.scanPoll);
    this.scanPoll = undefined;
    if (!this.loading || refresh) this.scanProgress = null;
    this.loading = true;
    this.previewing = false;
    this.loadingMore = false;
    this.error = "";
    this.previewFilename = null;
    this.lightboxFile = null;
    this.files = [];
    this.hasMore = false;
    this.totals = null;
    this.hosts = [];
    this.generatedAt = null;
    this.showInventory();
    if (this.previewRequested) this.loadPreview(version);
    await this.loadAuditPage(version, refresh);
  }

  private async loadAuditPage(version: number, refresh = false) {
    try {
      const res = await this.fetchPage(0, refresh);
      if (version !== this.requestVersion) return;
      if (res.scanning) {
        this.scanProgress = res.progress || null;
        if (this.scanPoll === undefined && !this.previewRequested && !this.onlyOrphans && !this.onlyHostFlagged) {
          this.loadPreview(version);
        }
        this.scanPoll = setTimeout(() => this.loadAuditPage(version), SCAN_POLL_MS);
        return;
      }
      this.files = res.page.files;
      this.page = 0;
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
      this.activeBucket = res.page.bucket || "";
      this.categories = res.categories;
      this.setYears(res.years || []);
      this.generatedAt = res.generatedAt;
      this.canonicalHost = res.canonicalHost;
      this.hosts = res.hosts;
      this.totals = res.totals;
      this.previewRequested = false;
      this.previewing = false;
      this.scanProgress = null;
      this.loading = false;
    } catch (err) {
      if (version === this.requestVersion) {
        this.error = err?.error?.error || "Could not load the media audit.";
        this.scanProgress = null;
        this.loading = false;
      }
    }
  }

  private async loadPreview(version: number) {
    try {
      const res = await this.fetchPage(0, false, true);
      if (version !== this.requestVersion || !this.loading) return;
      this.files = res.page.files;
      this.filteredTotal = res.page.filteredTotal;
      this.previewing = true;
    } catch (_) {
      // The full audit is still running and will supply the file list.
      if (version === this.requestVersion) this.previewRequested = false;
    }
  }

  browseAll() {
    if (!this.loading || this.previewRequested) return;
    this.previewRequested = true;
    this.loadPreview(this.requestVersion);
  }

  async loadMore(ev) {
    const version = this.requestVersion;
    if (this.loading || this.deleting || this.loadingMore || !this.hasMore) {
      ev.target.complete();
      return;
    }
    this.loadingMore = true;
    try {
      const res = await this.fetchPage(this.page + 1);
      if (version !== this.requestVersion) return;
      this.files = this.files.concat(res.page.files);
      this.page = res.page.page;
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
    } catch (err) {
      if (version === this.requestVersion) await this.showToast(err?.error?.error || "Could not load more files.");
    } finally {
      if (version === this.requestVersion) this.loadingMore = false;
      ev.target.complete();
    }
  }

  changeYear(value: number | "all") {
    const year = value === "all" ? null : value;
    if (this.year === year) return;
    this.year = year;
    this.reload();
  }

  async confirmDeleteYear() {
    const category = this.activeCategory;
    const year = this.year;
    if (this.deleting || this.loading || this.error || !this.onlyOrphans || year === null || !category?.deletable ||
        (!category.eligibleFiles && !category.pendingDeletes)) return;

    const alert = await this.alertController.create({
      header: `Delete unreferenced media from ${year}?`,
      message: `This permanently deletes eligible files in ${category.label} for ${year} (UTC), including files hidden by other filters. The server will recheck references and keep uploads under 24 hours old.`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        { text: "Delete", role: "destructive" },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== "destructive" || this.deleting || this.destroyed) return;

    this.deleting = true;
    try {
      const started = await this.authService.deleteUnreferencedMedia(category.bucket, year);
      const result = "id" in started ? await this.waitForCleanup(started) : started;
      if (!this.destroyed) {
        await this.showToast(`Deleted ${result.deletedFiles} file(s) (${this.fmtBytes(result.deletedBytes)}).`);
      }
    } catch (err) {
      if (!this.destroyed) {
        await this.showToast(err?.error?.error || (err instanceof Error ? err.message : "Could not confirm the cleanup result. Refresh the audit before retrying."));
      }
    } finally {
      this.deleting = false;
      this.cleanupProgress = null;
      this.cleanupPollingDelayed = false;
      if (!this.destroyed) await this.reload(true);
    }
  }

  private async waitForCleanup(job: MediaCleanupJob): Promise<MediaCleanupResult> {
    while (job.status === "running" && !this.destroyed) {
      this.cleanupProgress = job.progress;
      await new Promise((resolve) => setTimeout(resolve, CLEANUP_POLL_MS));
      if (this.destroyed) return;
      try {
        job = await this.authService.getMediaCleanup(job.id);
        this.cleanupPollingDelayed = false;
      } catch (err) {
        if (err.status !== 0 && err.status !== 429 && !(err.status >= 500)) throw err;
        this.cleanupPollingDelayed = true;
      }
    }
    if (job.status === "failed") throw new Error(job.error);
    if (job.status === "done") return job.result;
  }

  progressFraction(progress: MediaOperationProgress | null): number {
    return progress?.total > 0 ? Math.min(1, progress.completed / progress.total) : 0;
  }

  formatTimeRemaining(seconds: number): string {
    if (seconds < 60) return `${Math.max(5, Math.round(seconds / 5) * 5)} sec`;
    return `${Math.round(seconds / 60)} min`;
  }

  gameLabel(file: MediaFile): string {
    return [...new Set(file.games.map((game) => game.name || "(deleted game)"))].join(", ");
  }

  get activeCategory(): CategoryMeta | undefined {
    return this.categories.find((c) => c.bucket === this.activeBucket);
  }

  segmentChanged(ev) {
    if (this.activeBucket === ev.detail.value) return;
    this.activeBucket = ev.detail.value;
    this.reload();
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
    const t = await this.toastController.create({ message, duration: 4500 });
    await t.present();
  }
}
