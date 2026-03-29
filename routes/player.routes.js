import { Router } from "express";
import { authorizeSpotify } from "../middlewares/auth.middleware.js";
import { pauseTrack, playTrack, seekTrack } from "../controllers/player.controller.js";
const playerRouter = Router();

playerRouter.use(authorizeSpotify)
playerRouter.put('/play' , playTrack);
playerRouter.put('/pause' , pauseTrack);
playerRouter.put('/seek' , seekTrack);
export default playerRouter;
