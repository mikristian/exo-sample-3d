/** User-selected website origin. This setting only opens public pages; it
 * never authorizes the native bridge or transfers private project files. */
export function resolveClothCraftWebsite(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 512) return null;
  try {
    const url = new URL(input.trim());
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
    if (url.username || url.password || !url.hostname) return null;
    const root = `${url.origin}/`;
    return Object.freeze({
      root,
      marketplace: new URL('marketplace/', root).href,
      community: new URL('marketplace/#explore', root).href,
      download: new URL('download/', root).href,
    });
  } catch { return null; }
}
