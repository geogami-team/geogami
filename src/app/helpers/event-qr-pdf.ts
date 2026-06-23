import { jsPDF } from "jspdf";
import { Plugins, Capacitor, FilesystemDirectory } from "@capacitor/core";

/** One game's QR page in the event PDF. */
export interface EventQrGame {
  gameName: string;
  /** QR image as a data URL (PNG). */
  qrDataUrl: string;
  /** The play link encoded in the QR, printed small as a manual fallback. */
  link: string;
}

export interface EventQrPdfOptions {
  eventName: string;
  /** Optional short event description, printed on the cover. */
  eventDescription?: string;
  instructorLabel: string;
  /** The event owner — every QR attributes its track to them. */
  instructorName: string;
  scanCaption: string;
  /** Header label for the cover's game list, e.g. "Games in this event". */
  gamesHeading: string;
  games: EventQrGame[];
  /** Optional logo image URL for the header; skipped if it fails to load. */
  logoUrl?: string;
}

/**
 * Generates and downloads an A4 PDF for an event: a cover page (GeoGami logo +
 * event name + owner + the list of games) followed by one large-QR page per
 * game. Every QR links to a play that attributes its track to the event owner
 * (instructor) and tags it with the event.
 *
 * Mirrors the layout and native-vs-browser save behaviour of class-qr-pdf.ts so
 * the two exports look and feel the same.
 */
export async function downloadEventQrPdf(
  opts: EventQrPdfOptions
): Promise<void> {
  const eventName = opts.eventName || "GeoGami";

  const logo = opts.logoUrl
    ? await loadImage(opts.logoUrl).catch(() => null)
    : null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Cover page ────────────────────────────────────────────────────────
  let y = 16;
  if (logo) {
    const logoSize = 24;
    doc.addImage(logo, "PNG", (pageW - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 6;
  } else {
    y += 8;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(56, 128, 255);
  doc.text("GEOGAMI", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setDrawColor(56, 128, 255);
  doc.setLineWidth(1);
  doc.line(pageW / 2 - 12, y, pageW / 2 + 12, y);
  y += 14;

  // Event name (wraps for long titles)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(27, 28, 58);
  const nameLines = doc.splitTextToSize(eventName, pageW - 40);
  doc.text(nameLines, pageW / 2, y, { align: "center" });
  y += nameLines.length * 9 + 2;

  // Owner / instructor
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(90, 90, 90);
  doc.text(`${opts.instructorLabel}: ${opts.instructorName}`, pageW / 2, y, {
    align: "center",
  });
  y += 10;

  // Optional description
  if (opts.eventDescription) {
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    const descLines = doc.splitTextToSize(opts.eventDescription, pageW - 50);
    doc.text(descLines, pageW / 2, y, { align: "center" });
    y += descLines.length * 6 + 4;
  }

  y += 6;

  // Game list
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(27, 28, 58);
  doc.text(opts.gamesHeading, 24, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  opts.games.forEach((g, i) => {
    // Start a new page if the list overflows the cover.
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${i + 1}.  ${g.gameName}`, 28, y);
    y += 7;
  });

  // ── One QR page per game ─────────────────────────────────────────────
  for (const game of opts.games) {
    doc.addPage();
    renderGameQrPage(doc, pageW, opts, game, logo);
  }

  const safeName = eventName.replace(/[^a-z0-9]+/gi, "_");
  const fileName = `GeoGami-Event-${safeName}.pdf`;

  if (Capacitor.isNative) {
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.substring(dataUri.indexOf("base64,") + 7);
    const written = await Plugins.Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: FilesystemDirectory.Cache,
    });
    await Plugins.Share.share({
      title: eventName,
      url: written.uri,
      dialogTitle: eventName,
    });
  } else {
    doc.save(fileName);
  }
}

/** Renders a single game's large-QR page (matches the class-qr-pdf layout). */
function renderGameQrPage(
  doc: jsPDF,
  pageW: number,
  opts: EventQrPdfOptions,
  game: EventQrGame,
  logo: HTMLImageElement | null
): void {
  let y = 16;
  if (logo) {
    const logoSize = 20;
    doc.addImage(logo, "PNG", (pageW - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 5;
  } else {
    y += 8;
  }

  // Event name (small, above the game title)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(56, 128, 255);
  doc.text(opts.eventName.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 9;

  // Game name (wraps for long titles)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(27, 28, 58);
  const nameLines = doc.splitTextToSize(game.gameName, pageW - 40);
  doc.text(nameLines, pageW / 2, y, { align: "center" });
  y += nameLines.length * 8 + 2;

  // Owner / instructor
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(90, 90, 90);
  doc.text(`${opts.instructorLabel}: ${opts.instructorName}`, pageW / 2, y, {
    align: "center",
  });
  y += 10;

  // Large QR with a light rounded frame
  const qrSize = 115;
  const qrX = (pageW - qrSize) / 2;
  const qrY = y;
  doc.setDrawColor(230, 230, 239);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 3, 3);
  doc.addImage(game.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Caption
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text(opts.scanCaption, pageW / 2, qrY + qrSize + 16, { align: "center" });

  // Footer link (manual fallback)
  doc.setFontSize(8);
  doc.setTextColor(170, 170, 170);
  doc.text(game.link, pageW / 2, 288, {
    align: "center",
    maxWidth: pageW - 24,
  });
}

/** Loads an image and resolves once it's ready (for embedding in the PDF). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
