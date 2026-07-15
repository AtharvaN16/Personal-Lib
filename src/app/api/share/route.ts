import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';

function buildShareUrl(req: NextRequest, token: string | null): string | null {
  if (!token) return null;
  return `${req.nextUrl.origin}/share/${token}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data } = await supabase
    .from('profiles')
    .select('share_token, share_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  const shareToken = data?.share_token ?? null;
  const shareEnabled = data?.share_enabled ?? false;

  return NextResponse.json({
    shareToken,
    shareEnabled,
    shareUrl: buildShareUrl(req, shareToken),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { action?: string } | null;
  const action = body?.action;
  if (action !== 'enable' && action !== 'disable' && action !== 'regenerate') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('share_token')
    .eq('user_id', user.id)
    .maybeSingle();

  let shareToken = existing?.share_token ?? null;
  let shareEnabled: boolean;

  if (action === 'disable') {
    shareEnabled = false;
  } else if (action === 'regenerate') {
    shareToken = randomBytes(24).toString('base64url');
    shareEnabled = true;
  } else {
    // enable
    if (!shareToken) {
      shareToken = randomBytes(24).toString('base64url');
    }
    shareEnabled = true;
  }

  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, share_token: shareToken, share_enabled: shareEnabled }, { onConflict: 'user_id' });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    shareToken,
    shareEnabled,
    shareUrl: buildShareUrl(req, shareToken),
  });
}
