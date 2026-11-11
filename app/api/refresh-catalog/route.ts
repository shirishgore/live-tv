import { NextResponse } from 'next/server';
import { refreshCatalog } from '@/lib/actions';

export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const { total } = await refreshCatalog();
    return NextResponse.json({ ok: true, total });
  } catch (err) {
    console.error('Catalog refresh failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Catalog refresh failed.' },
      { status: 500 },
    );
  }
}
