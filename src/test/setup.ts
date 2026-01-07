import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { ConfigService } from '../services/ConfigService';

let mongoServer: MongoMemoryServer;

// Set up in-memory MongoDB for testing
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // Set mongoose options
  mongoose.set('strictQuery', false);

  // Initialize configuration service for validators that depend on it
  try {
    await ConfigService.initialize();
  } catch (err) {
    // If it fails, log and continue - tests will surface validation errors appropriately
    // eslint-disable-next-line no-console
    console.warn('ConfigService.initialize() failed in test setup:', err?.message || err);
  }
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
