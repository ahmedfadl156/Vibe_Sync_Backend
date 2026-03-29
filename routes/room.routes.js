import { Router } from "express";
import { authorize, authorizeSpotify } from "../middlewares/auth.middleware.js";
import { closeRoom, createRoom, getPublicRooms, joinRoom, leaveRoom } from "../controllers/room.controller.js";

const roomRouter = Router();

roomRouter.use(authorize)
roomRouter.get('/public' , getPublicRooms);
roomRouter.post('/' , authorizeSpotify , createRoom)
roomRouter.post("/join/:roomCode" , authorizeSpotify , joinRoom);

roomRouter.patch("/leave/:roomCode" , leaveRoom)
roomRouter.patch("/close/:roomCode" , closeRoom)
export default roomRouter;
