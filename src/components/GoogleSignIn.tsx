'use client';
import { signInUrl, useAccount } from '@/lib/account';
import { he } from '@/lib/i18n/he';
import { buttonClass } from './ui';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * "Sign in with Google" as a plain link to /api/auth/google (works without JS). Says that signing in
 * sets an essential cookie. When the server has no Google credentials, renders a disabled button and
 * an explanation instead.
 */
export function GoogleSignIn({ returnTo = '/account', label = he.account.google, variant = 'primary' as const, showNote = true }: { returnTo?: string; label?: string; variant?: 'primary' | 'secondary'; showNote?: boolean }) {
  const account = useAccount();
  const noteId = `gsi-note-${returnTo.replace(/[^a-z0-9]/gi, '')}`;
  if (account.loaded && !account.configured.google) {
    return (
      <div className="space-y-1">
        <button type="button" disabled aria-describedby={noteId} className={buttonClass({ variant: 'secondary', size: 'lg' })}>
          <GoogleMark />
          {label}
        </button>
        <p id={noteId} className="text-caption text-muted">
          {he.account.notConfigured}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <a href={signInUrl(returnTo)} aria-describedby={showNote ? noteId : undefined} className={buttonClass({ variant, size: 'lg', className: 'w-full sm:w-auto' })}>
        <span className="grid size-7 place-items-center rounded-full bg-white">
          <GoogleMark />
        </span>
        {label}
      </a>
      {showNote && (
        <p id={noteId} className="text-caption text-muted">
          {he.account.googleCookieNote}
        </p>
      )}
    </div>
  );
}
