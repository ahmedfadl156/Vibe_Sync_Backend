import catchAsync from "../utils/catchAsync.js";
import jwt from "jsonwebtoken";
import User from "../models/users.model.js";
import AppError from "../utils/appError.js";
import { refreshSpotifyToken } from "../services/spotify.service.js";

const SPOTIFY_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const getSessionUser = async (token, selectFields = "") => {
    if (!token) {
        throw new AppError("You are not logged in", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select(selectFields);

    if (!user) {
        throw new AppError("The user belonging to this token does not exist", 401);
    }

    return user;
};

export const authorize = catchAsync(async (req, res, next) => {
    const token = req.cookies.vibe_session;
    req.user = await getSessionUser(token);
    next();
});

export const authorizeSpotify = catchAsync(async (req, res, next) => {
    const token = req.cookies.vibe_session;
    const user = await getSessionUser(token, "+accessToken +refreshToken +tokenExpiresAt");

    if (!user.accessToken || !user.refreshToken || !user.tokenExpiresAt) {
        return next(new AppError("Spotify authorization is missing for this user", 401));
    }

    const expiresAt = new Date(user.tokenExpiresAt).getTime();
    const shouldRefresh = Number.isNaN(expiresAt) || expiresAt - Date.now() <= SPOTIFY_TOKEN_REFRESH_BUFFER_MS;

    req.user = user;
    req.spotifyToken = shouldRefresh ? await refreshSpotifyToken(user) : user.accessToken;

    next();
});
