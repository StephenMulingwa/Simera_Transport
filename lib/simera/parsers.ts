/**
 * Date/time formats from Wialon reports (aligned with simera.ipynb).
 */
export function parseReportDateTime(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "–" || s === "—") return null;

  const isoTry = Date.parse(s);
  if (!Number.isNaN(isoTry)) return new Date(isoTry);

  const dm = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (dm) {
    const [, dd, mm, yyyy, hh, mi, ss] = dm;
    return new Date(
      `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+03:00`,
    );
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (ymd) {
    return new Date(
      `${ymd[1]}-${ymd[2]}-${ymd[3]}T${ymd[4]}:${ymd[5]}:${ymd[6]}+03:00`,
    );
  }

  const fallback = Date.parse(s.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1"));
  if (!Number.isNaN(fallback)) return new Date(fallback);
  return null;
}

export function parseSpeedKmh(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const xl = String(raw)
    .toLowerCase()
    .replace(/km\/h/g, "")
    .replace(/,/g, ".")
    .trim();
  if (!xl || xl === "-") return null;
  const m = xl.match(/[-+]?\d*\.?\d+/);
  if (!m) return null;
  const v = parseFloat(m[0]!);
  return Number.isFinite(v) ? v : null;
}

export function parseMaxSpeedKmh(raw: string | null | undefined): number | null {
  return parseSpeedKmh(raw);
}

/** Extract plate-style registration from Grouping, e.g. "FG - Menengai - KCA 456U" → "KCA 456U" */
export function extractRegistration(grouping: string | null | undefined): string {
  if (!grouping) return "";
  const s = String(grouping).trim();
  const plate = s.match(/([A-Z]{3}\s+\d{3}[A-Z])\s*$/i);
  if (plate) {
    const p = plate[1]!.toUpperCase().replace(/\s+/g, " ").trim();
    return p;
  }
  const parts = s.split(/\s*-\s*/);
  const last = parts[parts.length - 1]?.trim();
  return last ?? s;
}

export function googleMapsSearchUrl(location: string): string {
  const q = encodeURIComponent(location.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
