import mongoose from 'mongoose';

let isMongoConnected = false;

export const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/softskillsai';
    mongoose.set('strictQuery', false);
    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 2000 // Quick timeout to fallback if no Mongo daemon
    });
    isMongoConnected = true;
    console.log('✅ MongoDB Connected successfully');
  } catch (error) {
    isMongoConnected = false;
    console.log('⚠️ MongoDB Connection Notice:', error.message);
    console.log('ℹ️ Running with File-backed Local Data Store fallback for seamless execution.');
  }
};

export const getMongoStatus = () => isMongoConnected;
