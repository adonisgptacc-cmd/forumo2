import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

async function forwardJson(req: NextRequest, endpoint: string, method: 'PATCH') {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const payload = await req.json();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token?.accessToken) {
      headers['Authorization'] = `Bearer ${token.accessToken}`;
    }
    const res = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Failed to forward listing mutation', error);
    return NextResponse.json({ message: 'Unable to update listing' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardJson(req, `${API_BASE_URL}/listings/${id}`, 'PATCH');
}
