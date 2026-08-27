import type { MetadataRoute } from "next";
import { COURSES } from "@/lib/courses";
import { LOCALES } from "@/lib/i18n/config";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://el-shemey.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    entries.push(
      { url: `${BASE}/${locale}`, changeFrequency: "weekly", priority: 1 },
      {
        url: `${BASE}/${locale}/courses`,
        changeFrequency: "weekly",
        priority: 0.9,
      },
    );
    for (const course of COURSES) {
      entries.push({
        url: `${BASE}/${locale}/courses/${course.slug}`,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }
  return entries;
}
