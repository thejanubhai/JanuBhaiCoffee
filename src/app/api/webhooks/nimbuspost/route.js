import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseWrapper';

// Initialize Supabase admin client to bypass RLS for webhook updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hmac-sha256');

    const secret = process.env.NIMBUSPOST_WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret is missing' }, { status: 500 });
    }

    // Nimbuspost uses base64 encoded binary hash
    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.awb_number && event.status) {
      // Update the order status in Supabase based on the AWB number
      const { error } = await supabase
        .from('orders')
        .update({ status: event.status.toLowerCase().replace(/ /g, '_') })
        .eq('awb_number', event.awb_number);

      if (error) {
        console.error('Nimbuspost Webhook Supabase Error:', error);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Nimbuspost Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
