import { Router } from "express";
import { authorizeSpotify } from "../middlewares/auth.middleware.js";
import { generateBlendPlaylist, generateMusicRoast, generateVibeMatch, getHispterMeter } from "../controllers/features.controller.js";

const featureRouter = Router();

featureRouter.use(authorizeSpotify)
featureRouter.get('/roast' , generateMusicRoast);
featureRouter.get('/hipster-meter' , getHispterMeter);
featureRouter.get('/vibe-match/:targetUserId' , generateVibeMatch);
featureRouter.post('/vibe-match/:targetUserId/blend' , generateBlendPlaylist);
export default featureRouter;
