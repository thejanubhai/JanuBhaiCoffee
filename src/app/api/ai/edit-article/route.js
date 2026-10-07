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

    const { action, content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      Accept: 'application/json',
    };

    let prompt = '';
    if (action === 'polish') {
      prompt = `You are an expert copy editor for the premium D2C brand Janu Bhai Coffee. 
      Please fix any grammatical errors, improve the flow, and polish the following Markdown text. 
      Do NOT change the formatting or remove any markdown syntax (like # headers or ![images]).
      Return ONLY the polished markdown text, without any conversational preamble or backticks.
      
      Here is the text to polish:
      \n\n${content}`;
    } else if (action === 'expand') {
      prompt = `You are an expert copywriter for the premium D2C brand Janu Bhai Coffee. 
      Please expand the following Markdown text to provide more detail, depth, and SEO value. 
      Maintain the same tone. Do NOT change the formatting or remove any existing markdown syntax.
      Return ONLY the expanded markdown text, without any conversational preamble or backticks.
      
      Here is the text to expand:
      \n\n${content}`;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const payload = {
      model: 'minimaxai/minimax-m3',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.5,
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
    let updatedContent = data.choices[0].message.content.trim();

    // Strip markdown formatting block if AI included it
    if (updatedContent.startsWith('```markdown'))
      updatedContent = updatedContent.replace(/^```markdown/, '');
    if (updatedContent.endsWith('```')) updatedContent = updatedContent.replace(/```$/, '');

    return NextResponse.json({ success: true, content: updatedContent.trim() });
  } catch (error) {
    console.error('AI Editing Error:', error);
    return NextResponse.json({ error: 'Failed to edit article' }, { status: 500 });
  }
}
