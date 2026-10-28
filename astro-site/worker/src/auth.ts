import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./types";

// JWKS fetchers are cached per team domain for the life of the isolate.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    );
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Guards /api/admin/*. Fails closed: outside ENVIRONMENT=development a valid
 * Cloudflare Access JWT (signature, issuer, audience, expiry) is mandatory,
 * so the API stays protected even if the Access app's path rules are wrong.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.env;

  if (env.ENVIRONMENT === "development") {
    c.set("adminEmail", "dev@localhost");
    return next();
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return c.json({ error: "Admin is not configured" }, 503);
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const { payload } = await jwtVerify(token, getJwks(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    });

    const email = typeof payload.email === "string" ? payload.email : "";
    const allowed = (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(email.toLowerCase())) {
      return c.json({ error: "Forbidden" }, 403);
    }

    c.set("adminEmail", email);
    return next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};
