import { pauseTrackOnSpotify, playTrackOnSpotify, seekTrackOnSpotify } from "../services/player.service.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

export const playTrack = catchAsync(async (req , res , next) => {
    const {trackUri , positionMs=0 , deviceId} = req.body;

    if(!trackUri){
        return next(new AppError("Please provide a track URI" , 404));
    }

    await playTrackOnSpotify(req.spotifyToken , trackUri , positionMs , deviceId);

    res.status(200).json({
        status: "success",
        message: "Track played successfully"
    });
});

export const pauseTrack = catchAsync(async (req, res, next) => {
    const { deviceId } = req.body;

    await pauseTrackOnSpotify(req.spotifyToken, deviceId);

    res.status(200).json({
        status: "success",
        message: "Playback paused"
    });
});

export const seekTrack = catchAsync(async (req, res, next) => {
    const { positionMs, deviceId } = req.body;

    if (positionMs === undefined) {
        return next(new AppError("Please provide positionMs", 400));
    }

    await seekTrackOnSpotify(req.spotifyToken, positionMs, deviceId);

    res.status(200).json({
        status: "success",
        message: `Seeked to ${positionMs}ms`
    });
});
