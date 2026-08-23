import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import AuthModal from "@/components/AuthModal";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-heading",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://rocky.legal";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0A09" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rocky.legal | India's First Free AI Legal Assistant for Advocates",
    template: "%s | Rocky.legal",
  },
  description:
    "India's premier AI legal assistant for advocates, law firms, and legal researchers. Research Supreme Court & High Court judgments, explore Bharatiya Nyaya Sanhita (BNS), analyze case law, draft petitions, and find citations in seconds. 100% Free.",
  applicationName: "Rocky.legal",
  authors: [{ name: "Rocky.legal Team", url: siteUrl }],
  generator: "Next.js",
  keywords: [
    "Rocky.legal",
    "AI Legal Assistant India",
    "Indian Law AI",
    "Supreme Court Judgments AI",
    "High Court Case Law AI",
    "Bharatiya Nyaya Sanhita AI",
    "BNS 2023",
    "BNSS 2023",
    "BSA 2023",
    "Free Legal AI for Advocates",
    "Legal Research Assistant India",
    "Indian Judgment Summarizer",
    "Legal Case Citation Search",
    "AI for Advocates India",
    "Law Firm AI Software India",
    "Indian Legal Tech",
  ],
  creator: "Rocky.legal",
  publisher: "Rocky.legal",
  category: "Legal Technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rocky.legal | India's First Free AI Legal Assistant for Advocates",
    description:
      "Instant, citation-backed legal research powered by AI. Search Supreme Court judgments, new criminal laws (BNS/BNSS/BSA), and prepare briefs with confidence.",
    url: siteUrl,
    siteName: "Rocky.legal",
    images: [
      {
        url: "/heroimg.png",
        width: 1200,
        height: 630,
        alt: "Rocky.legal — AI Legal Assistant for Indian Advocates",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rocky.legal | India's First Free AI Legal Assistant for Advocates",
    description:
      "Instant, citation-backed Indian legal research powered by AI. Free for advocates, law firms, and researchers.",
    images: ["/heroimg.png"],
    creator: "@rockylegal",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "geo.region": "IN",
    "geo.placename": "India",
    "language": "English, Hindi",
  },
};

// JSON-LD Structured Data Schema for Google Search
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "Rocky.legal",
      "description": "India's First Free AI Legal Assistant for Advocates and Legal Professionals",
      "publisher": {
        "@id": `${siteUrl}/#organization`,
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${siteUrl}/ask?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": "Rocky.legal",
      "url": siteUrl,
      "logo": `${siteUrl}/heroimg.png`,
      "sameAs": [
        "https://twitter.com/rockylegal",
        "https://www.linkedin.com/company/rockylegal",
        "https://instagram.com/rockylegal",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      "name": "Rocky.legal",
      "operatingSystem": "All",
      "applicationCategory": "LegalSoftware",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "INR",
      },
      "description":
        "AI-powered Indian legal research assistant specializing in Supreme Court precedents, High Court case law, and Bharatiya Nyaya Sanhita statutes.",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "scroll-smooth",
        "antialiased",
        dmSans.variable,
        dmSerif.variable,
        "font-sans"
      )}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <AuthModal />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
