import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { he } from '@/lib/i18n/he';

export const metadata: Metadata = {
  title: `${he.appName} · זיהוי ושיפור ניסוח AI`,
  description: he.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#14161a' },
  ],
};

// Apply the saved theme and text size before paint to avoid a flash.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('kulmus:settings:v1')||'{}');var t=s.theme||'system';var r=document.documentElement;if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))r.classList.add('dark');if(s.textSize==='large'||s.textSize==='larger')r.classList.add('text-size-'+s.textSize)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&family=JetBrains+Mono&display=swap"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
