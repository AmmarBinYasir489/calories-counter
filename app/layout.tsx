import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description =
    "AI-assisted nutrition tracking that learns the meals you actually eat.";

  return {
    metadataBase: new URL(origin),
    title: { default: "Nourish", template: "%s | Nourish" },
    description,
    icons: { icon: "/icon.svg" },
    openGraph: {
      title: "Nourish — nutrition that learns what you eat",
      description,
      type: "website",
      images: [
        {
          url: new URL("/og.png", origin).toString(),
          width: 1200,
          height: 630,
          alt: "Nourish nutrition dashboard",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Nourish — nutrition that learns what you eat",
      description,
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
