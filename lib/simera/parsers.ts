import type { ReportRow } from "@/lib/wialon/report";

/**
 * Date/time formats from telemetry reports (aligned with simera.ipynb).
 *
 * **Wialon API returns naive datetime strings in UTC** (the Wialon web UI then
 * renders them in the user's timezone — for Nairobi that is +3h). We therefore
 * parse every naive cell as **UTC** and let `Intl.DateTimeFormat` with
 * `Africa/Nairobi` render the EAT wall clock. This matches the cells you see
 * inside Wialon's UI exactly, on both local and deployed environments.
 */
function hasExplicitZone(s: string): boolean {
  const t = s.trim();
  if (/[zZ]$/i.test(t)) return true;
  if (/[+-]\d{2}:\d{2}$/.test(t)) return true;
  return false;
}

export function parseReportDateTime(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "–" || s === "—") return null;

  // 1) dd.mm.yyyy HH:mm:ss — Wialon API → UTC (renders as +3h in EAT)
  const dm = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (dm) {
    const [, dd, mm, yyyy, hh, mi, ss] = dm;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`);
  }

  // 2) yyyy-mm-dd HH:mm:ss(.fff)? — naive → UTC
  const ymdSpace =
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?$/.exec(s);
  if (ymdSpace) {
    const ss = ymdSpace[6] ?? "00";
    const frac = ymdSpace[7] ?? "";
    return new Date(
      `${ymdSpace[1]}-${ymdSpace[2]}-${ymdSpace[3]}T${ymdSpace[4]}:${ymdSpace[5]}:${ss}${frac}Z`,
    );
  }

  // 3) yyyy-mm-ddTHH:mm:ss(.fff)? without trailing zone — naive → UTC
  const ymdT =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(s);
  if (ymdT && !hasExplicitZone(s)) {
    const frac = ymdT[7] ?? "";
    return new Date(
      `${ymdT[1]}-${ymdT[2]}-${ymdT[3]}T${ymdT[4]}:${ymdT[5]}:${ymdT[6]}${frac}Z`,
    );
  }

  // 4) yyyy-mm-ddTHH:mm — rare, no seconds (naive → UTC)
  const ymdTShort =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (ymdTShort && !hasExplicitZone(s)) {
    return new Date(
      `${ymdTShort[1]}-${ymdTShort[2]}-${ymdTShort[3]}T${ymdTShort[4]}:${ymdTShort[5]}:00Z`,
    );
  }

  // 5) Explicit UTC / offset, or other formats Date handles reliably
  if (hasExplicitZone(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t);
  }

  // 6) Unix time as string (seconds or ms)
  if (/^\d{10}$/.test(s)) {
    const d = new Date(Number(s) * 1000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (/^\d{13}$/.test(s)) {
    const d = new Date(Number(s));
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 7) Last resort: rewrite dd.mm.yyyy → yyyy-mm-dd and parse as UTC.
  const reshaped = s.replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1");
  const ymdLoose = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(
    reshaped,
  );
  if (ymdLoose) {
    return new Date(
      `${ymdLoose[1]}-${ymdLoose[2]}-${ymdLoose[3]}T${ymdLoose[4]}:${ymdLoose[5]}:${ymdLoose[6]}Z`,
    );
  }
  const loose = Date.parse(reshaped);
  if (!Number.isNaN(loose)) return new Date(loose);

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

/**
 * Extract registration from Wialon "Grouping" / unit labels.
 * - Kenya-style: "… - KCA 456U" → `KCA 456U`
 * - Tanzania-style: "Overland - T256 DWQ - Scania" → `T256 DWQ`
 * - Other: prefer a dash-segment that looks like a plate (has digits), else last segment.
 */
export function extractRegistration(grouping: string | null | undefined): string {
  if (!grouping) return "";
  const s = String(grouping).trim().replace(/\s+/g, " ");

  // Kenya: trailing "KCA 456U" (3 letters + 3 digits + 1 letter)
  const ke = s.match(/([A-Z]{3}\s+\d{3}[A-Z])\s*$/i);
  if (ke) return ke[1]!.toUpperCase().replace(/\s+/g, " ").trim();

  const parts = s.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);

  const plateFromSegment = (seg: string): string | null => {
    const t = seg.trim();
    if (!t) return null;
    // Kenya full segment
    const keFull = t.match(/^([A-Z]{3}\s+\d{3}[A-Z])$/i);
    if (keFull) return keFull[1]!.toUpperCase().replace(/\s+/g, " ").trim();
    // Tanzania / EAC: letter + digits + space + letters, e.g. T256 DWQ, T962 EGG
    const tz = t.match(/^([A-Z]\d{2,4}\s+[A-Z]{2,4})$/i);
    if (tz) return tz[1]!.toUpperCase().replace(/\s+/g, " ").trim();
    // Compact T256DWQ → T256 DWQ
    const tzDense = t.match(/^([A-Z]\d{2,4})([A-Z]{2,4})$/i);
    if (tzDense) {
      return `${tzDense[1]!.toUpperCase()} ${tzDense[2]!.toUpperCase()}`;
    }
    return null;
  };

  for (const p of parts) {
    const hit = plateFromSegment(p);
    if (hit) return hit;
  }

  // Dash-separated: pick segment with digits (plate), not trailing model name (e.g. Scania)
  const withDigits = parts.filter((p) => /\d/.test(p) && /^[A-Z0-9\s]+$/i.test(p));
  if (withDigits.length === 1) return withDigits[0]!.toUpperCase();
  if (withDigits.length > 1) {
    const scored = withDigits
      .map((p) => ({ p, score: plateFromSegment(p) ? 2 : 1 }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0]!.p;
    const fromBest = plateFromSegment(best);
    if (fromBest) return fromBest;
    return best.toUpperCase();
  }

  const last = parts[parts.length - 1];
  return (last ?? s).toUpperCase();
}

/**
 * First non-empty location text among `textColumnAliases`, plus coords from the
 * same Wialon column (`${header}_coords`) when present. Avoids mixing e.g.
 * "End" time text with coords from "Final location".
 */
export function rowLocationCell(
  row: ReportRow,
  textColumnAliases: string[],
): { text: string; coords: string | null } {
  for (const alias of textColumnAliases) {
    const key = Object.keys(row).find(
      (k) => k.toLowerCase() === alias.toLowerCase(),
    );
    if (!key) continue;
    const text = String(row[key] ?? "").trim();
    if (!text) continue;
    const coordKey = `${key}_coords`;
    const raw = row[coordKey];
    const coords =
      raw != null && String(raw).trim() ? String(raw).trim() : null;
    return { text, coords };
  }
  return { text: "", coords: null };
}

/**
 * Open Google Maps with a precise pin when `coordsLatCommaLng` is "lat,lng"
 * from Wialon (see `cellCoordsLatCommaLng`); otherwise search by place label.
 */
export function googleMapsPlaceUrl(
  placeLabel: string,
  coordsLatCommaLng?: string | null,
): string {
  const label = placeLabel.trim();
  const c = (coordsLatCommaLng ?? "").trim();
  const q = encodeURIComponent(c || label);
  return `https://www.google.com/maps?q=${q}`;
}

/** @deprecated Prefer googleMapsPlaceUrl(label, coords) when coordinates exist. */
export function googleMapsSearchUrl(location: string): string {
  return googleMapsPlaceUrl(location, null);
}

/** "0:01:23" / "12:34:56" → total seconds. Returns null if not parseable. */
export function parseDurationSec(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(s);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const mm = /^(\d+):(\d{2})$/.exec(s);
  if (mm) return Number(mm[1]) * 60 + Number(mm[2]);
  return null;
}

/** 0 → "0s", 65 → "1m 5s", 3725 → "1h 2m". */
export function formatDurationHuman(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return "—";
  const s = Math.floor(totalSec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}
