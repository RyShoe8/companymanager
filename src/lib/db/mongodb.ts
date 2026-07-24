import 'server-only';
import mongoose from 'mongoose';
import { migrateOrganizationSlugs } from '@/lib/db/migrateOrganizationSlugs';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Use global to maintain a cached connection across hot reloads in development
declare global {
   
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  // If we have a cached connection, return it
  if (cached.conn) {
    return cached.conn;
  }

  // If we don't have a promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
    try {
      await migrateOrganizationSlugs();
    } catch (migrateErr) {
      console.error('[organization] slug migration failed', migrateErr);
    }
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
