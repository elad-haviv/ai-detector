import { accountResponse } from '@/lib/server/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Who is signed in, their plan, and whether sign-in / billing are configured. Never cached. */
export async function GET(req: Request) {
  return accountResponse(req);
}
