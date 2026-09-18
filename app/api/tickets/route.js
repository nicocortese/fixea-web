import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const tickets = await db.collection('tickets').find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(tickets, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const body = await request.json();

    const newTicket = {
      title: body.title || 'Sin título',
      description: body.description || '',
      url: body.url || ``,
      status: body.status || `open`,
      priority: body.priority || `medium`,
      createdAt: new Date(),
    };
    const result = await db.collection(`tickets`).insertOne(newTicket);
    return NextResponse.json({ success: true, ticketId: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}