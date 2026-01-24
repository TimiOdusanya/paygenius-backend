import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async (): Promise<void> => {
  const Db = process.env.MONGODB_URI;

  if (!Db) {
    throw new Error("❌ MONGODB_URI is not defined in the environment variables!");
  }

  try {
    await mongoose.connect(Db);
    console.log("Successfully connected to database");
  } catch (err) {
    console.error("ERROR - MONGODB CONNECTION ERROR", "connecting to database failed", err);
  }
};

export default connectDB;

