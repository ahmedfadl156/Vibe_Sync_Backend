import { Router } from "express";
import { callback, getMe, getMyLibrary, getToken, login, logout } from "../controllers/auth.controller.js";
import { authorize, authorizeSpotify } from "../middlewares/auth.middleware.js";
const authRouter = Router();

authRouter.get('/me' , authorize , getMe)
authRouter.get('/token' , authorizeSpotify , getToken);
authRouter.get('/library' , authorizeSpotify , getMyLibrary);
authRouter.get('/login' , login);
authRouter.get('/callback' , callback)
authRouter.post('/logout' , logout)
export default authRouter;
