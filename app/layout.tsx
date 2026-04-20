import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "GammaMeet", template: "%s · GammaMeet" },
  description: "Turn every meeting into a beautiful AI-generated presentation deck. Automatically, the moment your meeting ends.",
  metadataBase: new URL("https://gammameet.vercel.app"),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "GammaMeet",
    description: "Turn every meeting into a beautiful AI-generated presentation deck.",
    url: "https://gammameet.vercel.app",
    siteName: "GammaMeet",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "GammaMeet" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GammaMeet",
    description: "Turn every meeting into a beautiful AI-generated presentation deck.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white dark:bg-black text-zinc-900 dark:text-white transition-colors">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
