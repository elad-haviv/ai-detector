import { Suspense } from 'react';
import { Workspace } from '@/components/Workspace';

export default function Home() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
