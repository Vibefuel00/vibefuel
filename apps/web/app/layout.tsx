import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import "./landing.css"
import "./app.css"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const DESCRIPTION =
  "See ads in your coding tools. Earn tokens on Solana from advertisers and put them toward your next AI credits."

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Vibefuel", template: "%s" },
  description: `Let your vibe coding pay for itself. ${DESCRIPTION}`,
  applicationName: "Vibefuel",
  keywords: ["AI coding", "Cursor", "VS Code", "Solana", "developer rewards", "advertising"],
  creator: "Danilo (@danilobleal)",
  openGraph: {
    type: "website",
    siteName: "Vibefuel",
    title: "Vibefuel — Let your vibe coding pay for itself.",
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibefuel — Let your vibe coding pay for itself.",
    description: DESCRIPTION,
    creator: "@danilobleal",
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      {/* Browser extensions often add attributes to body before hydration. */}
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}
