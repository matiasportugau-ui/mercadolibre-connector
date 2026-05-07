import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
  }

  const connectorUrl = process.env.NEXT_PUBLIC_CONNECTOR_URL ?? 'http://localhost:3001';
  const target = new URL('/auth/ml/start', connectorUrl);
  target.searchParams.set('user_token', session.access_token);

  return NextResponse.redirect(target.toString());
}
