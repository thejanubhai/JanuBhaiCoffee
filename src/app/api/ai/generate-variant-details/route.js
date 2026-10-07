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

    const { productName, variantName, roast, blendRatio } = await req.json();

    if (!productName || !variantName) {
      return NextResponse.json(
        { error: 'Product name and Variant name are required' },
        { status: 400 },
      );
    }

    const headers = {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      Accept: 'application/json',
    };

    const prompt = `You are a master coffee roaster and food scientist for "Janu Bhai Coffee".
    We are adding a new variant to our product catalog. Generate accurate nutritional facts and scientific details for this variant.
    
    Product: ${productName}
    Variant Name: ${variantName}
    Roast Level: ${roast || 'Medium'}
    Blend Ratio: ${blendRatio || '100% Arabica'}
    
    Requirements:
    1. Output MUST be in raw JSON format.
    2. JSON structure: 
    {
      "scientific_details": "A highly engaging, scientific but accessible paragraph (2-3 sentences) explaining the roasting process, flavor extraction, caffeine strength, and why this specific blend/roast is unique.",
      "nutrition": {
        "energy": "number (kcal)",
        "protein": "number (g)",
        "fat": "number (g)",
        "carbs": "number (g)",
        "sugar": "number (g)",
        "caffeine": "number (mg)"
      }
    }
    3. The nutritional facts should be highly realistic for 100g of instant coffee powder. (Instant coffee is typically ~350 kcal, high carbs, some protein, low fat, 0 sugar unless specified). Chicory alters these slightly (adds more carbs).
    4. ONLY output the JSON object, NO markdown formatting, NO backticks.`;

    const payload = {
      model: 'minimaxai/minimax-m3',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
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

    if (content.startsWith('```json')) content = content.replace(/^```json/, '');
    if (content.endsWith('```')) content = content.replace(/```$/, '');

    const parsed = JSON.parse(content);

    return NextResponse.json({ success: true, ...parsed });
  } catch (error) {
    console.error('AI Variant Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate variant details' }, { status: 500 });
  }
}
