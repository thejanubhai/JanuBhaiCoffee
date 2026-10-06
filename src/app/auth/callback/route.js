import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { cookies } from 'next/headers';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) return NextResponse.redirect(`${origin}/?error=missing_token`);

  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, returnSecureToken: true }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message);

    let adminApp;
    if (getApps().length > 0) adminApp = getApp();
    else adminApp = initializeApp({ credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    })});

    const adminAuth = getAuth(adminApp);
    const sessionCookie = await adminAuth.createSessionCookie(data.idToken, { expiresIn: 60 * 60 * 24 * 5 * 1000 });

    const cookieStore = await cookies();
    cookieStore.set('__session', sessionCookie, { maxAge: 60 * 60 * 24 * 5 * 1000, httpOnly: true, secure: true, path: '/' });

    return NextResponse.redirect(`${origin}/outlet/dashboard`);
  } catch (error) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }
}
