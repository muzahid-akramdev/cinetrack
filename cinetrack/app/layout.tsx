import type { Metadata } from 'next'
import { Fraunces, Work_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
})
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: 'CineTrack — track every movie and show',
  description:
    'An IMDb-style catalog with Letterboxd-style tracking for movies and TV, with dedicated coverage for Bangladeshi, Indian, Pakistani, Turkish and Korean dramas alongside global content.',
}

const noFlashThemeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${workSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased dark:bg-ink dark:text-paper">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
