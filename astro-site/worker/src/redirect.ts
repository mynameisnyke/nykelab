/** `www.nykelab.nyc/x?y` -> `https://nykelab.nyc/x?y` (permanent). Anything else is left alone (null). */
export function wwwRedirect(requestUrl: string): string | null {
  const u = new URL(requestUrl);
  if (!u.hostname.startsWith("www.") || u.hostname === "www.workers.dev") return null;
  return `https://${u.hostname.slice(4)}${u.pathname}${u.search}`;
}
