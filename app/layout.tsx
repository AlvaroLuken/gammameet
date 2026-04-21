import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserIdentify } from "@/components/UserIdentify";
import { auth } from "@/lib/auth";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "GammaMeet — Every meeting, beautifully decked.", template: "%s · GammaMeet" },
  description: "GammaMeet turns your meeting recordings into stunning AI-generated presentation decks — automatically, the moment your meeting ends. Powered by Gamma AI.",
  metadataBase: new URL("https://www.gamma-meet.com"),
  alternates: { canonical: "/" },
  keywords: [
    "meeting notes", "AI meeting recap", "Gamma AI", "presentation deck",
    "meeting bot", "Google Meet bot", "Zoom bot", "meeting transcription", "AI presentation",
    "automatic meeting summary", "action items", "meeting recording",
  ],
  authors: [{ name: "GammaMeet" }],
  creator: "GammaMeet",
  publisher: "GammaMeet",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  openGraph: {
    title: "GammaMeet — Every meeting, beautifully decked.",
    description: "Turn every meeting into a beautiful AI-generated presentation deck. Automatically, the moment your meeting ends.",
    url: "https://www.gamma-meet.com",
    siteName: "GammaMeet",
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "GammaMeet — Every meeting, beautifully decked." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GammaMeet — Every meeting, beautifully decked.",
    description: "Turn every meeting into a beautiful AI-generated presentation deck.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white dark:bg-black text-zinc-900 dark:text-white transition-colors">
        <UserIdentify userEmail={session?.user?.email ?? null} userName={session?.user?.name ?? null} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
