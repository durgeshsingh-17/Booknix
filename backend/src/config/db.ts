import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

export const connectDB = async (): Promise<void> => {
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });

  logger.info('MongoDB connected successfully');
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
};
