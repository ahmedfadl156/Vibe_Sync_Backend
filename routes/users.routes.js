import { Router } from "express";
import { generateVibePlaylist, saveTopTracksToPlaylist } from "../controllers/user.controller.js";
import { authorizeSpotify } from "../middlewares/auth.middleware.js";
const userRouter = Router();

userRouter.use(authorizeSpotify)
userRouter.post('/save-top-tracks' , saveTopTracksToPlaylist)
userRouter.post('/generate-vibe' , generateVibePlaylist)
export default userRouter;
