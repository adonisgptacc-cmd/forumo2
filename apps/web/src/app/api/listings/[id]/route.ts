import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

async function forwardJson(req: NextRequest, endpoint: string, method: 'PATCH') {
  try {
    const payload = await req.json();
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return forwardJson(req, `${API_BASE_URL}/listings/${params.id}`, 'PATCH');
}
