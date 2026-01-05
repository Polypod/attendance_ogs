import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';

let mongoServer: MongoMemoryServer;

// Set up in-memory MongoDB for testing
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // Set mongoose options
  mongoose.set('strictQuery', false);
});

// Clear all test data after each test
afterEach(async () => {
  const collections = (mongoose.connection as Connection).collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Close the connection and stop the server
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
