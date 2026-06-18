import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Providers } from '@/components/providers'
import './globals.css'

// Self-hosted DM trio (latin) so the build is reproducible without a
// Google Fonts fetch at build time.
const dmSerif = localFont({
  src: './fonts/dmserif-400.woff2',
  weight: '400',
  variable: '--font-dm-serif',
  display: 'swap',
})
const dmSans = localFont({
  src: './fonts/dmsans-var.woff2',
  weight: '400 700',
  variable: '--font-dm-sans',
  display: 'swap',
})
const dmMono = localFont({
  src: [
    { path: './fonts/dmmono-400.woff2', weight: '400' },
    { path: './fonts/dmmono-500.woff2', weight: '500' },
  ],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CFMFHE Analytics',
  description:
    'Membership & revenue analytics for Come Follow Me FHE — unified across WooCommerce, Shopify, Klaviyo, and GA4.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSerif.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
