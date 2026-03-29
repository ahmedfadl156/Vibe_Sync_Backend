import User from "../models/users.model.js";
import { refreshSpotifyToken } from "../services/spotify.service.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";
import { getHispterMeterAI, getUserRoasted, getVibeMatchAnalysis } from "../services/ai.service.js";

export const generateMusicRoast = catchAsync(async (req , res , next) => {
    const lang = req.query.lang === 'en' ? 'en' : 'ar';
    const user = await User.findById(req.user.id).select('musicRoast');

    if(user.musicRoast && user.musicRoast.generatedAt && user.musicRoast.language === lang ){
        const daySiceLastRoast = (Date.now() - user.musicRoast.generatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if(daySiceLastRoast  < 7){
            return res.status(200).json({
                status: "success",
                source: "cache",
                data: user.musicRoast
            });
        }
    }

    const headers = { 'Authorization': `Bearer ${req.spotifyToken}` };
    const [artistsRes, tracksRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/top/artists?limit=5&time_range=short_term', { headers }),
        fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term', { headers })
    ]);

    const artistsData = await artistsRes.json();
    const tracksData = await tracksRes.json();
    if(!artistsData.items || !tracksData.items){
        return next(new AppError("You don't have enough listening history to roast!" , 400));
    }

    const topArtists = artistsData.items.map(a => a.name).join(', ');
    const topTracks = tracksData.items.map(t => `${t.name} by ${t.artists[0].name}`).join(', ');
    const roasted = await getUserRoasted(lang , topArtists , topTracks);

    user.musicRoast = {
        roastText: roasted.roastText,
        guiltyPleasures: roasted.guiltyPleasures,
        therapyPlaylist: roasted.therapyPlaylist,
        language: lang,
        generatedAt: Date.now(),
    };

    await user.save({validateBeforeSave: false});

    res.status(200).json({
        status: "success",
        source: "ai",
        data: user.musicRoast
    });
});

export const getHispterMeter = catchAsync(async (req , res , next) => {
    const user = await User.findById(req.user.id);

    if(user.hipsterMeter && user.hipsterMeter.generatedAt){
        const daysSinceLastCheck = (Date.now() - user.hipsterMeter.generatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if(daysSinceLastCheck < 7){
            return res.status(200).json({
                status: "success",
                source: "cache",
                data: user.hipsterMeter
            });
        }
    }

    const response = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50', {
        headers: { 'Authorization': `Bearer ${req.spotifyToken}` }
    });

    const data = await response.json();

    if(!data.items || data.items.length === 0){
        return next(new AppError("You don't listen to enough music to be judged!", 400));
    }

    const artistsNames = data.items.map(a => a.name).join(', ');
    const hipsterData = await getHispterMeterAI(artistsNames);
    const mainstreamScore = hipsterData.averageScore;
    const hipsterScore = 100 - mainstreamScore;

    const obsecureArtistFromSpotify = data.items.find(
        a => a.name.toLowerCase() === hipsterData.mostObscureArtistName.toLowerCase()
    ) || data.items[0];

    let badge = "";
    let badgeDescription = "";

    if (mainstreamScore >= 75) {
        badge = "100% Basic 🥱";
        badgeDescription = "يعني ذوقك ماشي مع التريند ومفيش ميكروباص في مصر مش مشغل أغانيك. إنت بتلعب في المضمون ومبتحبش تكتشف جديد.";
    } else if (mainstreamScore >= 55) {
        badge = "Mainstream with a Twist 📻";
        badgeDescription = "بتحب التريندات وتسمع الهيتس، بس كل فين وفين بتجيب أغنية غريبة تعمل بيها روش على أصحابك.";
    } else if (mainstreamScore >= 35) {
        badge = "Cultured Explorer 🧐";
        badgeDescription = "ذوقك متوازن بمزاج. بتسمع المشاهير، بس عندك جزء كبير من البلاي ليست بتاعتك مليان ناس محدش يعرفهم غيرك.";
    } else {
        badge = "Underground King 👑";
        badgeDescription = "إنت عايش في كهف موسيقي! 90% من اللي بتسمعهم بيسجلوا أغانيهم في الحمام وسبوتيفاي نفسه ميعرفش هما مين.";
    }

    user.hipsterMeter = {
        mainstreamScore: mainstreamScore,
        hipsterScore: hipsterScore,
        badge: badge,
        badgeDescription: badgeDescription,
        proof: {
            name: obsecureArtistFromSpotify.name,
            image: obsecureArtistFromSpotify.images[0]?.url || null,
            roastMessage: hipsterData.obscureReason
        },
        generatedAt: Date.now()
    };
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: "success",
        source: "ai",
        data: user.hipsterMeter
    });
});

export const generateVibeMatch = catchAsync(async (req , res , next) => {
    const currentUserId = req.user.id;
    const targetUserId = req.params.targetUserId;

    if(currentUserId === targetUserId){
        return next(new AppError('You can\'t match with yourself' , 400));
    }

    const currentUser = await User.findById(currentUserId).select('vibeMatches displayName');
    const targetUser = await User.findById(targetUserId).select('+accessToken +refreshToken +tokenExpiresAt displayName');

    if(!targetUser){
        return next(new AppError('Target user not found' , 404));
    }

    const existingMatch = currentUser.vibeMatches.find(
        m => m.targetUserId.toString() === targetUserId.toString()
    );

    if (existingMatch && existingMatch.generatedAt) {
        const daysSinceMatch = (Date.now() - existingMatch.generatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceMatch < 7) {
            return res.status(200).json({
                status: "success",
                source: "cache",
                targetUserName: targetUser.displayName,
                data: existingMatch
            });
        }
    }

    let currentToken = req.spotifyToken;
    let targetToken = targetUser.accessToken;

    if (Date.now() > new Date(targetUser.tokenExpiresAt).getTime()) {
        targetToken = await refreshSpotifyToken(targetUser);
    }

    const [currentUserRes , targetUserRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=10', { headers: { 'Authorization': `Bearer ${currentToken}` } }),
        fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=10', { headers: { 'Authorization': `Bearer ${targetToken}` } })
    ]);

    const currentUserData = await currentUserRes.json();
    const currentTargetData = await targetUserRes.json();

    const currentArtistsArray = currentUserData.items?.map(artist => artist.name) || [];
    const targetArtistsArray = currentTargetData.items?.map(artist => artist.name) || [];
    const commonArtists = currentArtistsArray.filter(artist => targetArtistsArray.includes(artist));

    const currentUserArtistsString = currentArtistsArray.join(', ');
    const targetUserArtistsString = targetArtistsArray.join(', ');
    const vibeMatchResult = await getVibeMatchAnalysis(targetUserArtistsString, currentUserArtistsString , targetUser.displayName , currentUser.displayName);

    const newMatch = {
        targetUserId: targetUserId,
        matchScore: vibeMatchResult.matchScore,
        analysis: vibeMatchResult.analysis,
        commonGround: commonArtists.length > 0 ? commonArtists.slice(0, 4) : vibeMatchResult.commonGround,
        generatedAt: Date.now()
    };

    currentUser.vibeMatches = currentUser.vibeMatches.filter(m => m.targetUserId.toString() !== targetUserId.toString());
    currentUser.vibeMatches.push(newMatch);

    await currentUser.save({ validateBeforeSave: false });

    res.status(200).json({
        status: "success",
        source: "ai",
        targetUserName: targetUser.displayName,
        data: newMatch
    });
});
