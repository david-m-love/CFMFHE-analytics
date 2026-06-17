# CFMFHE Analytics

An end-to-end coding platform where users enter text prompts and an AI agent generates full-stack applications in a sandboxed environment with live preview, file explorer, and command logs.

## Features

- Multi-model support via AI Gateway (Claude, GPT, Grok)
- Secure code execution with Vercel Sandbox
- Real-time live preview of generated apps
- File explorer for browsing project files
- Command logs and error monitoring
- One-click deploy to Vercel

## Tech Stack

- [Next.js](https://nextjs.org) with Turbopack
- [AI SDK](https://ai-sdk.dev) v6
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)

## Getting Started

### Run Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supported Models

- Claude Opus 4.6
- Claude Sonnet 4.6
- GPT-5.3 Codex
- Grok 4.1 Reasoning

## Deploy

Click the deploy button above or run:

```bash
vc deploy
```
