import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { ConfigService } from '../services/ConfigService';

let mongoServer: MongoMemoryServer;

// MongoMemoryServer startup can exceed Jest's default 5s timeout in CI/containers
jest.setTimeout(30000);

// Set up in-memory MongoDB for testing
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  // Set mongoose options
  mongoose.set('strictQuery', false);

  // Initialize configuration service for validators that depend on it
  await ConfigService.initialize();
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
  if (mongoServer) {
    await mongoServer.stop();
  }
});
