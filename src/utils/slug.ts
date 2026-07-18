import crypto from "crypto";

/**
 * slugifyName — a URL-safe base from a display name. Lowercased, non-alnum
 * runs collapsed to hyphens, trimmed, capped. Falls back to "user" if the
 * name has no usable characters.
 */
export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "user";
}

/**
 * publicSlug — slugified name + short random suffix (e.g. "asha-rao-a4f9").
 * The suffix curbs profile-URL enumeration and sidesteps name collisions,
 * so a single generated value is almost always unique per college.
 */
export function publicSlug(name: string): string {
  return `${slugifyName(name)}-${crypto.randomBytes(2).toString("hex")}`;
}
