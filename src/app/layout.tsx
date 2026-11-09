import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { dirOf } from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/client';
import { getLocale, getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.meta.title,
    description: t.tagline,
    applicationName: t.appName,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#14161a' },
  ],
};

// Apply the saved theme and text size before paint to avoid a flash. The settings may still sit
// under the app's former storage key until storageMigration.ts runs, so fall back to it.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('penprint:settings:v1')||localStorage.getItem('kulmus:settings:v1')||'{}');var t=s.theme||'system';var r=document.documentElement;if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))r.classList.add('dark');if(s.textSize==='large'||s.textSize==='larger')r.classList.add('text-size-'+s.textSize)}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Language comes from the penprint_lang cookie (else Accept-Language), so the first paint is
  // already in the right language and direction.
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
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
        <LocaleProvider locale={locale}>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
