import { Router } from "express";
import { getTrackLyrics } from "../controllers/songs.controller.js";
import { authorize } from "../middlewares/auth.middleware.js";

const songRouter = Router();

songRouter.use(authorize)
songRouter.get('/lyrics' , getTrackLyrics)

export default songRouter;