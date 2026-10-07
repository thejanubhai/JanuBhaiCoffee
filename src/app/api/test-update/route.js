import { createClient } from '@/lib/supabaseWrapper';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  // 1. Fetch an article
  const { data: articles, error: fetchError } = await supabaseAdmin
    .from('articles')
    .select('*')
    .limit(1);
  if (fetchError) return NextResponse.json({ error: 'Fetch error', details: fetchError });

  if (!articles || articles.length === 0) return NextResponse.json({ error: 'No articles found' });

  const article = articles[0];

  // 2. Try to update it with the same payload structure
  const payload = {
    title: article.title,
    slug: article.slug + '-test',
    content: article.content,
    meta_title: article.meta_title,
    meta_description: article.meta_description,
    published: article.published,
  };

  const { data, error } = await supabaseAdmin.from('articles').update(payload).eq('id', article.id);

  if (error) {
    return NextResponse.json({ error: 'Update error', details: error });
  }

  // Restore slug
  await supabaseAdmin.from('articles').update({ slug: article.slug }).eq('id', article.id);

  return NextResponse.json({ success: true, article });
}
