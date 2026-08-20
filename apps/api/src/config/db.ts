import mongoose from 'mongoose';

const MONGODB_URI =
  Bun.env.MONGODB_URI ||
  'mongodb://root:example@localhost:27017/snapsplit?authSource=admin';

const DATABASE_NAME = Bun.env.DATABASE_NAME || 'snapsplit';

export async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB database: ${DATABASE_NAME}`);
  return mongoose.connection;
}

export async function disconnectDB() {
  mongoose.disconnect();
  console.log(`✅ Disconnected from MongoDB database: ${DATABASE_NAME}`);
}
