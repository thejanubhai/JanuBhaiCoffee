import { createClient } from '@/lib/supabaseWrapper';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: products, error } = await supabase.from('products').select('*');
  return NextResponse.json({ products, error });
}
