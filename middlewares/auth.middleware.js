import catchAsync from "../utils/catchAsync.js";
import jwt from "jsonwebtoken";
import User from "../models/users.model.js";
import AppError from "../utils/appError.js";
export const authorize = catchAsync(async (req , res , next) => {
    // هنجيب التوكن بتاع اليوزر
    const token = req.cookies.vibe_session;

    if(!token){
        return next(new AppError('You are not logged in' , 401));
    }

    const decoded = jwt.verify(token , process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if(!user){
        return next(new AppError('The user belonging to this token does not exist' , 401));
    }

    req.user = user;
    next();
})