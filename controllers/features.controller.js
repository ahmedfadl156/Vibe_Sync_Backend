import User from "../models/users.model.js";
import { addTracksToPlaylist, createSpotifyPlaylist, refreshSpotifyToken } from "../services/spotify.service.js";
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


const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const generateBlendPlaylist = catchAsync(async (req , res , next) => {
    // هنجيب الاتنين يوزرز تبوعنا
    const currentUserId = req.user.id;
    const targetUserId = req.params.targetUserId;

    // نجيب التوكنات بتاعتهم ونجددها لو هيا خلصت او مش متجددة
    const currentUser = await User.findById(currentUserId).select('+accessToken +tokenExpiresAt displayName vibeMatches');
    const targetUser = await User.findById(targetUserId).select('+accessToken +tokenExpiresAt displayName');

    if(!currentUser){
        return next(new AppError('Current user not found' , 404));
    }

    if(!targetUser){
        return next(new AppError('Target user not found' , 404));
    }

    // نجيب الفنانين المشتركين من الماتش اللى لسه معمول
    const existingMatch = (currentUser.vibeMatches || []).find(
        m => m.targetUserId.toString() === targetUserId.toString()
    )

    if(!existingMatch){
        return next(new AppError('You need to generate a vibe match with this user before creating a blend playlist' , 400));
    }

    // هنحيب الفنانين دول
    const commonArtists = existingMatch.commonGround;

    let currentToken = req.spotifyToken;
    let targetToken = targetUser.accessToken;

    if (Date.now() > new Date(targetUser.tokenExpiresAt).getTime()) {
        targetToken = await refreshSpotifyToken(targetUser);
    }

    const [currentUserRes , targetUserRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=20', { headers: { 'Authorization': `Bearer ${currentToken}` } }),
        fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=20', { headers: { 'Authorization': `Bearer ${targetToken}` } })
    ]);

    const currentTracksData = await currentUserRes.json();
    const targetTracksData = await targetUserRes.json();

    // هنعمل سيت علشان مفيش حاجة تتكرر نحط فيها اللى هنسمعه
    const playlistUris = new Set();

    // هنضيف الاغانى بتاعت اليوزرز
    currentTracksData.items?.forEach(track => playlistUris.add(track.uri));
    targetTracksData.items?.forEach(track => playlistUris.add(track.uri));

    // هنجيب 5 اغانى لكل فنان مشترك
    const artistSearchPromises = commonArtists.map(artistsName => {
        const query = encodeURIComponent(`artist:${artistsName}`);
        return fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=10`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        }).then(res => res.json());
    })
    
    const artistsSearchResults = await Promise.all(artistSearchPromises);

    // نحط ال 5 اغانى بتوع كل فنان فى ال set بتاعتنا
    artistsSearchResults.forEach(result => {
        result.tracks?.items?.forEach(track => playlistUris.add(track.uri));
    });

    // هنعمل shuffle عشان الاغانى متبقاش محطوط بشكل مترتب كدا هنخلطهم فى بعض
    let finalPlaylistArray = Array.from(playlistUris);
    finalPlaylistArray = shuffleArray(finalPlaylistArray);

    // نكريبت البلاى ليست فى حساب اليوزر الاساسى
    const playlistName = `VibeSage Blend: ${currentUser.displayName} + ${targetUser.displayName} 🎧`;
    const description = `A perfect blend: 10 of your hits, 10 of theirs, and the artists that bring you together. Generated with a ${existingMatch.matchScore}% Vibe Match!`;

    const newPlaylist = await createSpotifyPlaylist(currentToken, playlistName, description);

    // نضيف الاغانى اللى جمعناها فى البلاى ليست
    if(!newPlaylist || !newPlaylist.id){
        return next(new AppError('Failed to create playlist on Spotify' , 500));
    }

    await addTracksToPlaylist(currentToken, newPlaylist.id, finalPlaylistArray);

    res.status(200).json({
        status: "success",
        message: "Blend Playlist Created Successfully!",
        totalTracks: finalPlaylistArray.length,
        playlistUrl: newPlaylist.external_urls.spotify
    });
})
