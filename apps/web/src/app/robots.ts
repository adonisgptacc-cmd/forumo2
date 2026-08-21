import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://forumo.africa";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/app/",
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/unauthorized",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
