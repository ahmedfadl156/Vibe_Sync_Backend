import { Router } from "express";
import { callback, getMe, getMyLibrary, login, logout } from "../controllers/auth.controller.js";
import {authorize} from "../middlewares/auth.middleware.js"
const authRouter = Router();

authRouter.get('/me' , authorize , getMe)
authRouter.get('/library' , authorize , getMyLibrary);
authRouter.get('/login' , login);
authRouter.get('/callback' , callback)
authRouter.post('/logout' , logout)
export default authRouter;