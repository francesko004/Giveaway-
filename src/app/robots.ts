import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: ["/giveaway", "/verify", "/terms", "/privacy"], disallow: ["/admin", "/api", "/q/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
