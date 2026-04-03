import SongLyrics from "../models/songs.model.js";
import { findLyricsWithFallback } from "../services/songs.service.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

export const getTrackLyrics = catchAsync(async (req , res , next) => {
    // هنجيب الملعومات من اليوزر
    const {trackId , artistName , trackName} = req.body;
    // لو كل البيانات مش موجودة نرجع ايرور
    if(!trackId || !artistName || !trackName) {
        return next(new AppError("Missing required track information" , 400))
    }

    //نشوف خزنا الاغنية دى عندنا قبل كدا فى الداتابيز
    let existingLyrics = await SongLyrics.findOne({trackId});
    // لو لقيناها موجودة عندنا نرجعها
    if(existingLyrics && existingLyrics.status === 'approved') {
        return res.status(200).json({
            status: 'success',
            source: 'database',
            data: existingLyrics
        });
    }

    //  لو مش موجودة نشغل البحث بتاعنا بقا
    const lyricsResult = await findLyricsWithFallback(artistName , trackName);

    if(!lyricsResult) {
        return res.status(404).json({
            status: "Fail",
            message: "Lyrics not found for this track",
            action: "prompt_user_submission",
            trackData: {trackId , artistName , trackName}
        })
    };

    // لو موجودة نسيفها فى الداتابيز عندنا
    const savedLyrics = await SongLyrics.findOneAndUpdate(
        {trackId},
        {
            trackId,
            artistName,
            trackName,
            lyrics: lyricsResult.lyrics,
            source: lyricsResult.source,
            status: "approved"
        },
        {returnDocument: "after", upsert: true, setDefaultsOnInsert: true}
    );

    res.status(200).json({
        status: "success",
        source: lyricsResult.source,
        data: savedLyrics,
        promptVote: true
    })
})