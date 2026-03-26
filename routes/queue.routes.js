import { Router } from "express";
import { authorize } from "../middlewares/auth.middleware.js";
import { addTrack, getRoomQueue, voteTrack } from "../controllers/queue.controller.js";

const queueRouter = Router();

queueRouter.use(authorize)

queueRouter.post('/:roomId/add' , addTrack)
queueRouter.patch('/vote/:queueItemId' , voteTrack);
queueRouter.get('/:roomId' , getRoomQueue)
export default queueRouter;