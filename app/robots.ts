import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/profile", "/meetings/", "/add-bot", "/signout"],
      },
    ],
    sitemap: "https://www.gamma-meet.com/sitemap.xml",
    host: "https://www.gamma-meet.com",
  };
}
