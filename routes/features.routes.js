import { Router } from "express";
import { authorizeSpotify } from "../middlewares/auth.middleware.js";
import { generateMusicRoast, generateVibeMatch, getHispterMeter } from "../controllers/features.controller.js";

const featureRouter = Router();

featureRouter.use(authorizeSpotify)
featureRouter.get('/roast' , generateMusicRoast);
featureRouter.get('/hipster-meter' , getHispterMeter);
featureRouter.get('/vibe-match/:targetUserId' , generateVibeMatch);
export default featureRouter;
