import mongoose from "mongoose";
import { env } from "./config.ts";

export const connectMongo = async () => {
  await mongoose.connect(env.MONGO_URL);
};

export const disconnectMongo = () => mongoose.disconnect();
