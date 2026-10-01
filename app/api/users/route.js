import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const currentUID = searchParams.get('currentUID') || '';

    await connectToDatabase();

    const users = await User.find({
      name: { $regex: query, $options: 'i' },
      cometchatUID: { $ne: currentUID }
    }).select('name email cometchatUID').limit(10);

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}