/**
 * Validation for images sent to the server as data URLs or links.
 */

const RASTER_DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/;
const LOGO_DATA_URL = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/;

/** Approximate decoded byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1).replace(/\s/g, "") : "";
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function isHttpsUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export type ImageCheck = { ok: true; value: string | null } | { ok: false; error: string };

/** After-photo for a repair: a raster data URL up to `maxBytes`, or an https link. */
export function checkRepairPhoto(value: unknown, maxBytes = 2.5 * 1024 * 1024): ImageCheck {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "The repair photo isn't a valid image." };
  if (value.startsWith("data:")) {
    if (!RASTER_DATA_URL.test(value)) {
      return { ok: false, error: "Upload the repair photo as a JPG, PNG or WebP image." };
    }
    if (dataUrlBytes(value) > maxBytes) {
      return { ok: false, error: "The repair photo is too large. Use a photo under 2.5 MB." };
    }
    return { ok: true, value };
  }
  if (isHttpsUrl(value)) return { ok: true, value };
  return { ok: false, error: "The repair photo must be an uploaded image or an https link." };
}

/** NGO logo: a small image data URL (SVG allowed; it is only ever shown inside <img>) or an https link. */
export function checkLogo(value: unknown, maxBytes = 300 * 1024): ImageCheck {
  if (value === undefined || value === null || value === "") return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: "The logo isn't a valid image." };
  if (value.startsWith("data:")) {
    if (!LOGO_DATA_URL.test(value)) {
      return { ok: false, error: "Upload the logo as a PNG, JPG, SVG or WebP image." };
    }
    if (dataUrlBytes(value) > maxBytes) {
      return { ok: false, error: "The logo is too large. Use an image under 300 KB." };
    }
    return { ok: true, value };
  }
  if (value.startsWith("/") && !value.startsWith("//") && value.length < 300) return { ok: true, value };
  if (isHttpsUrl(value)) return { ok: true, value };
  return { ok: false, error: "The logo must be an uploaded image or an https link." };
}

/** Rejects request bodies whose declared size is over `maxBytes`. */
export function bodyTooLarge(req: Request, maxBytes: number): boolean {
  const len = Number(req.headers.get("content-length") || 0);
  return Number.isFinite(len) && len > maxBytes;
}
