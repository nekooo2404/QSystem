import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastRegion } from '../components/ToastHost';
import { ThemeProvider } from '../lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--qs-font-sans',
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
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <ToastRegion position="bottom-right" />
      </body>
    </html>
  );
}
