import mongoose from "mongoose";
import dns from "dns";

dns.setServers(['1.1.1.1', '8.8.8.8']);
const connectDB = async () => {
    if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in config/.env");
}

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
};

export default connectDB; 