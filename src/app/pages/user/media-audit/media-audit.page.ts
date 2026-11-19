import { Component, OnInit } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular";
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
  eligibleFiles: number;
  pendingDeletes: number;
  deletable: boolean;
}

const PAGE_SIZE = 20;

@Component({
  selector: "app-media-audit",
  templateUrl: "./media-audit.page.html",
  styleUrls: ["./media-audit.page.scss"],
})
export class MediaAuditPage implements OnInit {
  selecting = false;
  metaLoading = false;
  metaError = "";
  selectableCategories: { bucket: string; label: string; totalFiles: number; selected: boolean }[] = [];
  private selectedBuckets: string[] = [];

  loading = true;
  deleting = false;
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

  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.reload();
  }

  async loadCategories() {
    this.selecting = true;
    this.metaLoading = true;
    this.metaError = "";
    try {
      const res = await this.authService.GetMediaCategories();
      this.selectableCategories = (res.categories || []).map((c: CategoryMeta) => ({
        bucket: c.bucket,
        label: c.label,
        totalFiles: c.totalFiles,
        selected: !this.selectedBuckets.length || this.selectedBuckets.includes(c.bucket),
      }));
    } catch (err) {
      this.metaError = err?.error?.error || "Could not load media categories.";
    } finally {
      this.metaLoading = false;
    }
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

  private fetchPage(page: number, refresh = false) {
    return this.authService.GetMediaAudit({
      buckets: this.selectedBuckets.join(","),
      bucket: this.activeBucket,
      year: this.year,
      page,
      limit: PAGE_SIZE,
      q: this.search.trim(),
      hostFlagged: this.onlyHostFlagged,
      orphans: this.onlyOrphans,
      refresh,
    });
  }

  async reload(refresh = false) {
    const version = ++this.requestVersion;
    this.loading = true;
    this.loadingMore = false;
    this.error = "";
    this.previewFilename = null;
    this.lightboxFile = null;
    this.hasMore = false;
    try {
      const res = await this.fetchPage(0, refresh);
      if (version !== this.requestVersion) return;
      this.files = res.page.files;
      this.page = 0;
      this.filteredTotal = res.page.filteredTotal;
      this.hasMore = res.page.hasMore;
      this.activeBucket = res.page.bucket || "";
      this.categories = res.categories;
      const years = new Set<number>(res.years);
      if (this.year !== null) years.add(this.year);
      this.years = [...years].sort((a, b) => b - a);
      this.generatedAt = res.generatedAt;
      this.canonicalHost = res.canonicalHost;
      this.hosts = res.hosts;
      this.totals = res.totals;
    } catch (err) {
      if (version === this.requestVersion) this.error = err?.error?.error || "Could not load the media audit.";
    } finally {
      if (version === this.requestVersion) this.loading = false;
    }
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
    if (this.deleting || this.loading || year === null || !category?.deletable ||
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
    if ((await alert.onDidDismiss()).role !== "destructive" || this.deleting) return;

    this.deleting = true;
    try {
      const result = await this.authService.deleteUnreferencedMedia(category.bucket, year);
      await this.showToast(`Deleted ${result.deletedFiles} file(s) (${this.fmtBytes(result.deletedBytes)}).`);
    } catch (err) {
      await this.showToast(err?.error?.error || "Cleanup did not finish. Retry the same category and year.");
    } finally {
      await this.reload(true);
      this.deleting = false;
    }
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
