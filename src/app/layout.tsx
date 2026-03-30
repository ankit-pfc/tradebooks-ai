import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tradebooks.ai'),
  title: {
    default: 'TradeBooks AI | Zerodha to Tally XML — Automated',
    template: '%s | TradeBooks AI',
  },
  description:
    'Convert Zerodha broker exports into Tally-importable XML automatically. Built for Indian CAs, accountants, and active traders. Exception-first reconciliation. No manual posting.',
  keywords: ['zerodha tally', 'zerodha accounting', 'tally xml import', 'CA accounting tool india', 'STCG LTCG tally entries'],
  authors: [{ name: 'TradeBooks AI' }],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'TradeBooks AI',
    title: 'TradeBooks AI — Zerodha to Tally, Automated',
    description: 'Upload Zerodha exports, review exceptions, download Tally-importable XML in minutes.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TradeBooks AI — Zerodha to Tally' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeBooks AI — Zerodha to Tally, Automated',
    description: 'Convert Zerodha exports to Tally XML. Exception-first reconciliation for CAs and traders.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
