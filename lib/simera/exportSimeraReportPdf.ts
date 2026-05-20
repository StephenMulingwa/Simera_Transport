import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { SIMERA_LOGO_INTRINSIC, loadSimeraLogoDataUrl } from "./loadSimeraLogo";

export interface SimeraSummarySegment {
  text: string;
  color?: string;
}

export interface SimeraSummaryItem {
  label: string;
  value: string;
  accent?: string;
  segments?: SimeraSummarySegment[];
}

export interface SimeraReportSection {
  heading?: string;
  head: RowInput[];
  body: RowInput[];
  columnStyles?: Parameters<typeof autoTable>[1]["columnStyles"];
}

export interface ExportSimeraReportPdfOpts {
  title: string;
  subtitle?: string;
  summary?: SimeraSummaryItem[];
  narrative?: string;
  sections: SimeraReportSection[];
  fileName: string;
  landscape?: boolean;
}

/** Simera Control Tower palette (burgundy / red / gold). */
const BRAND_DEEP: [number, number, number] = [122, 13, 24];
const BRAND_RED: [number, number, number] = [181, 15, 31];
const BRAND_ACCENT: [number, number, number] = [253, 224, 71];

const PAGE_MARGIN = 36;
const HEADER_HEIGHT = 78;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function getLastAutoTableY(doc: jsPDF): number | undefined {
  const ref = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return ref.lastAutoTable?.finalY;
}

function drawHeader(
  doc: jsPDF,
  opts: ExportSimeraReportPdfOpts,
  logoDataUrl: string | null,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND_DEEP);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT / 2, "F");
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, HEADER_HEIGHT / 2, pageWidth, HEADER_HEIGHT / 2, "F");

  let textX = PAGE_MARGIN;

  if (logoDataUrl) {
    const logoH = 40;
    const logoW =
      (SIMERA_LOGO_INTRINSIC.width / SIMERA_LOGO_INTRINSIC.height) * logoH;
    const logoY = (HEADER_HEIGHT - logoH) / 2;
    try {
      doc.addImage(logoDataUrl, "PNG", PAGE_MARGIN, logoY, logoW, logoH);
      textX = PAGE_MARGIN + logoW + 16;
    } catch {
      /* render without logo */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.title, textX, 34);

  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_ACCENT);
    doc.text(opts.subtitle, textX, 54);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const stamp = `Generated ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} (EAT)`;
  doc.text(stamp, pageWidth - PAGE_MARGIN, 22, { align: "right" });
  doc.setTextColor(...BRAND_ACCENT);
  doc.text(
    "Simera Transport · Control Tower",
    pageWidth - PAGE_MARGIN,
    40,
    { align: "right" },
  );
}

function drawSummary(
  doc: jsPDF,
  summary: SimeraSummaryItem[],
  startY: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availW = pageWidth - PAGE_MARGIN * 2;
  const gap = 10;
  const boxH = 54;
  const count = summary.length;
  if (count === 0) return startY;
  const boxW = (availW - gap * (count - 1)) / count;
  const defaultText: [number, number, number] = [55, 35, 35];

  for (let i = 0; i < count; i += 1) {
    const item = summary[i]!;
    const x = PAGE_MARGIN + i * (boxW + gap);

    doc.setFillColor(255, 247, 247);
    doc.setDrawColor(254, 202, 202);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, startY, boxW, boxH, 6, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(127, 29, 29);
    doc.text(item.label.toUpperCase(), x + 12, startY + 16, {
      maxWidth: boxW - 24,
    });

    const accent = item.accent ? hexToRgb(item.accent) : null;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);

    if (item.segments && item.segments.length > 0) {
      let cursorX = x + 12;
      const baselineY = startY + 40;
      for (const seg of item.segments) {
        const segColor = seg.color ? hexToRgb(seg.color) : accent;
        if (segColor) doc.setTextColor(...segColor);
        else doc.setTextColor(...defaultText);
        doc.text(seg.text, cursorX, baselineY);
        cursorX += doc.getTextWidth(seg.text);
      }
    } else {
      if (accent) doc.setTextColor(...accent);
      else doc.setTextColor(...defaultText);
      doc.text(item.value, x + 12, startY + 40, { maxWidth: boxW - 24 });
    }
  }

  return startY + boxH + 14;
}

function drawNarrative(doc: jsPDF, text: string, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availW = pageWidth - PAGE_MARGIN * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 55, 65);
  const lines = doc.splitTextToSize(text, availW) as string[];
  doc.text(lines, PAGE_MARGIN, startY + 4);
  return startY + 4 + lines.length * 12 + 6;
}

function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(252, 165, 165);
    doc.setLineWidth(0.5);
    doc.line(
      PAGE_MARGIN,
      pageHeight - 28,
      pageWidth - PAGE_MARGIN,
      pageHeight - 28,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.text(
      "Powered by ControlTech · Simera Transport",
      PAGE_MARGIN,
      pageHeight - 14,
    );
    doc.text(
      `Page ${p} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 14,
      { align: "right" },
    );
  }
}

export async function exportSimeraReportPdf(
  opts: ExportSimeraReportPdfOpts,
): Promise<void> {
  const doc = new jsPDF({
    orientation: opts.landscape !== false ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadSimeraLogoDataUrl();

  drawHeader(doc, opts, logoDataUrl);

  let cursorY = HEADER_HEIGHT + 18;

  if (opts.summary && opts.summary.length > 0) {
    cursorY = drawSummary(doc, opts.summary, cursorY);
  }

  if (opts.narrative) {
    cursorY = drawNarrative(doc, opts.narrative, cursorY);
  }

  for (const section of opts.sections) {
    if (section.heading) {
      if (cursorY > pageHeight - 110) {
        doc.addPage();
        cursorY = PAGE_MARGIN;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(122, 13, 24);
      doc.text(section.heading, PAGE_MARGIN, cursorY + 4);
      cursorY += 14;
    }

    autoTable(doc, {
      startY: cursorY,
      head: section.head,
      body: section.body,
      styles: {
        fontSize: 7.4,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 40 },
      tableWidth: "auto",
      showHead: "everyPage",
      columnStyles: section.columnStyles,
    });

    cursorY = (getLastAutoTableY(doc) ?? cursorY) + 18;
  }

  drawFooter(doc);
  doc.save(opts.fileName);
}

export function formatDateRangeLabel(start: string, end: string): string {
  const toLabel = (raw: string) => {
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString("en-GB", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };
  const a = toLabel(start);
  const b = toLabel(end);
  if (!a && !b) return "";
  return `${a} → ${b} (EAT)`;
}
