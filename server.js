import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";
import http from "http"
import { Server } from "socket.io";
import dns from "dns";
dotenv.config({ path: "config/.env" });

dns.setServers(["8.8.8.8" , "1.1.1.1"]);
const PORT = process.env.PORT || 5500;


const httpServer = http.createServer(app);
const io = new Server(httpServer , {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST" , "PATCH"],
        credentials: true
    }
})

app.set("io" , io);

io.on("connection" , (socket) => {
    console.log("New connection" , socket.id);

    socket.on('join_room', (data) => {
        const roomId = data.roomId || data; 
        
        socket.join(roomId.toString()); 
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    socket.on("disconnect" , () => {
        console.log("User disconnected" , socket.id);
    })
})

const startServer = async () => {
    try {
    await connectDB();

    httpServer.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    httpServer.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the running process or change PORT in config/.env.`);
        process.exit(1);
        }

        console.error("Server failed:", error.message); 
        process.exit(1); 
    });
} catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
}
};

startServer();
