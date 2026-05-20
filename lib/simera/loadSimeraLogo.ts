/** Approximate intrinsic ratio of `public/SimeraLogo.png` for PDF layout. */
export const SIMERA_LOGO_INTRINSIC = { width: 120, height: 36 };

let cachedDataUrl: string | null | undefined;

/** Load Simera logo as a data URL for jsPDF `addImage` (browser only). */
export async function loadSimeraLogoDataUrl(): Promise<string | null> {
  if (cachedDataUrl !== undefined) return cachedDataUrl;
  try {
    const r = await fetch("/SimeraLogo.png");
    if (!r.ok) {
      cachedDataUrl = null;
      return null;
    }
    const blob = await r.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(blob);
    });
    cachedDataUrl = dataUrl;
    return dataUrl;
  } catch {
    cachedDataUrl = null;
    return null;
  }
}
