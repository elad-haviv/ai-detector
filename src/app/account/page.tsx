import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from '@/components/AccountView';
import { he } from '@/lib/i18n/he';

export const metadata: Metadata = { title: `${he.account.title} · ${he.appName}` };

export default function AccountPage() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
