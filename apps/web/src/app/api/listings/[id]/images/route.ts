import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Image file is required' }, { status: 400 });
    }

    const res = await fetch(`${API_BASE_URL}/listings/${id}/images`, {
      method: 'POST',
      body: formData,
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
    console.error('Failed to upload listing image', error);
    return NextResponse.json({ message: 'Unable to upload image' }, { status: 500 });
  }
}
