import { jsPDF } from "jspdf";
import { Plugins, Capacitor, FilesystemDirectory } from "@capacitor/core";

export interface ClassQrPdfOptions {
  /** The QR image as a data URL (e.g. from the rendered <ngx-qrcode> img). */
  qrDataUrl: string;
  gameName: string;
  instructorLabel: string;
  instructorName: string;
  scanCaption: string;
  /** The class link, printed small in the footer as a manual fallback. */
  link: string;
  /** Optional logo image URL for the header; skipped if it fails to load. */
  logoUrl?: string;
}

/**
 * Generates and downloads a professionally laid-out A4 PDF for a class QR code
 * (GeoGami logo + game name + instructor + a large QR).
 *
 * Pure of any component state: the caller passes in the QR image (data URL) and
 * the text to show, so this stays testable and reusable.
 */
export async function downloadClassQrPdf(
  opts: ClassQrPdfOptions
): Promise<void> {
  const gameName = opts.gameName || "GeoGami";

  // Load the logo for the header (skip gracefully if it fails).
  const logo = opts.logoUrl
    ? await loadImage(opts.logoUrl).catch(() => null)
    : null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 16;

  // Header: logo + brand + accent rule
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

  // Game name (wraps for long titles)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(27, 28, 58);
  const nameLines = doc.splitTextToSize(gameName, pageW - 40);
  doc.text(nameLines, pageW / 2, y, { align: "center" });
  y += nameLines.length * 9 + 2;

  // Instructor
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(90, 90, 90);
  doc.text(`${opts.instructorLabel}: ${opts.instructorName}`, pageW / 2, y, {
    align: "center",
  });
  y += 12;

  // Large QR with a light rounded frame
  const qrSize = 120;
  const qrX = (pageW - qrSize) / 2;
  const qrY = y;
  doc.setDrawColor(230, 230, 239);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 3, 3);
  doc.addImage(opts.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Caption
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text(opts.scanCaption, pageW / 2, qrY + qrSize + 18, { align: "center" });

  // Footer link (manual fallback)
  doc.setFontSize(8);
  doc.setTextColor(170, 170, 170);
  doc.text(opts.link, pageW / 2, 288, {
    align: "center",
    maxWidth: pageW - 24,
  });

  const safeName = gameName.replace(/[^a-z0-9]+/gi, "_");
  const fileName = `GeoGami-${safeName}.pdf`;

  if (Capacitor.isNative) {
    // Native webviews can't do a browser download, and jsPDF's fallback opens
    // the PDF inside the webview with no way to close it. Instead, write the
    // file and open the OS share/save sheet (which is dismissable).
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.substring(dataUri.indexOf("base64,") + 7);
    const written = await Plugins.Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: FilesystemDirectory.Cache,
    });
    await Plugins.Share.share({
      title: gameName,
      url: written.uri,
      dialogTitle: gameName,
    });
  } else {
    // Browser: trigger a normal download.
    doc.save(fileName);
  }
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