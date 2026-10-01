import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const cometchatUID = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    // 1. Register User in CometChat via REST API
    const ccResponse = await fetch(
      `https://${process.env.NEXT_PUBLIC_COMETCHAT_APP_ID}.api-${process.env.NEXT_PUBLIC_COMETCHAT_REGION}.cometchat.io/v3/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiKey': process.env.COMETCHAT_REST_API_KEY || ''
        },
        body: JSON.stringify({ uid: cometchatUID, name })
      }
    );

    if (!ccResponse.ok) {
      const errData = await ccResponse.json();
      console.warn('CometChat User Sync Warning:', errData);
    }

    // 2. Save User in MongoDB
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      cometchatUID
    });

    return NextResponse.json({
      success: true,
      user: { id: newUser._id, name: newUser.name, email: newUser.email, cometchatUID: newUser.cometchatUID }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}