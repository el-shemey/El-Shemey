import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://el-shemey.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", disallow: ["/design"] },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
