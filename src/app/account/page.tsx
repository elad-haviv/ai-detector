import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from '@/components/AccountView';
import { pageTitle } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return pageTitle((t) => t.account.title);
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
