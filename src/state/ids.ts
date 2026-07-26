/**
 * Random ids for gear items and swaps.
 *
 * crypto.randomUUID is restricted to secure contexts (https / localhost), and
 * the app is legitimately used over plain http on a LAN (planning from a
 * phone against a laptop's dev server). crypto.getRandomValues has no such
 * restriction, so fall back to assembling a v4 UUID from it.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return (
    h.slice(0, 4).join("") +
    "-" +
    h.slice(4, 6).join("") +
    "-" +
    h.slice(6, 8).join("") +
    "-" +
    h.slice(8, 10).join("") +
    "-" +
    h.slice(10).join("")
  );
}
