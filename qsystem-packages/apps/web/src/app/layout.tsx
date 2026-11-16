import type { Metadata } from 'next';
import { Be_Vietnam_Pro, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { ToastRegion } from '../components/ToastHost';
import { ThemeProvider } from '../lib/theme';
import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--qs-font-sans',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--qs-font-display',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--qs-font-mono',
});

export const metadata: Metadata = {
  title: 'QSystem',
  description: 'Không gian làm việc của QSystem.',
};

// Runs before first paint so an existing light preference never flashes dark.
// It owns `data-theme` exclusively: React renders no such attribute, so
// hydration can never re-apply a server value over the user's saved choice.
const THEME_SCRIPT = `(function(){var t='dark';try{if(localStorage.getItem('qsystem-theme')==='light')t='light';}catch(e){}document.documentElement.setAttribute('data-theme',t);})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${ibmPlexSans.variable} ${beVietnamPro.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <ToastRegion position="bottom-right" />
      </body>
    </html>
  );
}
