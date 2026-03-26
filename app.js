import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import cors from "cors";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import AppError from "./utils/appError.js";
import dotenv from "dotenv"
import authRouter from "./routes/auth.routes.js";
import { authorize } from "./middlewares/auth.middleware.js";
import roomRouter from "./routes/room.routes.js";
import queueRouter from "./routes/queue.routes.js";
import userRouter from "./routes/users.routes.js";
dotenv.config({path: "config/.env"})
const app = express();

// Middlewares
app.use(logger("dev"));
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL, 
  credentials: true
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

//ROUTES
app.use('/api/v1/auth' , authRouter);
app.use('/api/v1/rooms' , roomRouter)
app.use('/api/v1/queue' , queueRouter)
app.use('/api/v1/users' , userRouter);
app.get('/api/v1/auth/me' , authorize , (req , res) => {
  res.status(200).json({
    status: "success",
    message: "You are authorized",
    data: req.user
  })
})

// If the requested routed not created on our server
app.all("*" , (req , res , next) => {
  next(new AppError(`Can't Find ${req.originalUrl} pn this server!` , 404))
})
// Global Error Handler Middleware
app.use(errorMiddleware);

export default app;
