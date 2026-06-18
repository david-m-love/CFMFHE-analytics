import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ChatProvider } from '@/lib/chat-context'
import { CommandLogsStream } from '@/components/commands-logs/commands-logs-stream'
import { ErrorMonitor } from '@/components/error-monitor/error-monitor'
import { SandboxState } from '@/components/modals/sandbox-state'
import { Toaster } from '@/components/ui/sonner'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'

// CFMFHE brand type: clean humanist sans for body, elegant serif for
// headings, and a flowing script for the wordmark. Self-hosted (latin
// subsets) so the build is reproducible without a Google Fonts fetch.
const nunito = localFont({
  src: './fonts/nunito-latin.woff2',
  weight: '400 800',
  variable: '--font-nunito',
  display: 'swap',
})

const playfair = localFont({
  src: './fonts/playfair-latin.woff2',
  weight: '400 700',
  variable: '--font-playfair',
  display: 'swap',
})

const sacramento = localFont({
  src: './fonts/sacramento-latin.woff2',
  weight: '400',
  variable: '--font-sacramento',
  display: 'swap',
})

const title = 'CFMFHE Analytics'
const description = `CFMFHE Analytics is an end-to-end coding platform where the user can enter text prompts, and the agent will create a full stack application. It uses Vercel's AI Cloud services like Sandbox for secure code execution, AI Gateway for GPT-5 and other models support, Fluid Compute for efficient rendering and streaming, and it's built with Next.js and the AI SDK.`

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${playfair.variable} ${sacramento.variable}`}
    >
      <body className="antialiased">
        <Suspense fallback={null}>
          <NuqsAdapter>
            <ChatProvider>
              <ErrorMonitor>{children}</ErrorMonitor>
            </ChatProvider>
          </NuqsAdapter>
        </Suspense>
        <Toaster />
        <CommandLogsStream />
        <SandboxState />
      </body>
    </html>
  )
}
