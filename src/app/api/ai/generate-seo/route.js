import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseWrapper';

const INVOKE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const adminEmails = (process.env.SUPERADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    if (!adminEmails.includes(user.email?.toLowerCase()))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { productName, description, price } = await req.json();

    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      Accept: 'application/json',
    };

    const prompt = `You are an expert SEO copywriter for "Janu Bhai Coffee", a premium Delhi-based D2C coffee brand.
    Write a highly converting, SEO-optimized Title and Meta Description for the following product:
    Product Name: ${productName}
    Price: ₹${price}
    Context Description: ${description || 'Premium authentic Chikmagalur coffee.'}
    
    Requirements:
    1. Output MUST be in raw JSON format.
    2. JSON structure: {"seo_title": "...", "seo_description": "..."}
    3. seo_title should be under 60 characters and catchy.
    4. seo_description should be under 160 characters, include keywords like "buy online", "India", "premium", and end with a call to action.
    5. ONLY output the JSON object, NO markdown formatting, NO backticks.`;

    const payload = {
      model: 'minimaxai/minimax-m3',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
      top_p: 0.95,
      stream: false,
    };

    const response = await fetch(INVOKE_URL, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error('NVIDIA API Error:', errData);
      throw new Error(`NVIDIA API Error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();

    // Strip markdown JSON block if AI included it
    if (content.startsWith('```json')) content = content.replace(/^```json/, '');
    if (content.endsWith('```')) content = content.replace(/```$/, '');

    const parsed = JSON.parse(content);

    return NextResponse.json({ success: true, seo: parsed });
  } catch (error) {
    console.error('AI Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate SEO' }, { status: 500 });
  }
}
