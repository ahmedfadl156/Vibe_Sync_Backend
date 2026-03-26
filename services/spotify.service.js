import { validate } from "node-cron";
import Room from "../models/rooms.model.js";
import AppError from "../utils/appError.js";
import User from "../models/users.model.js";
import { redisClient } from "../config/redis.js";

const SPOTIFY_API_URL = "https://api.spotify.com";
const parseSpotifyResponse = async (response, fallbackMessage) => {
    const rawResponse = await response.text();

    try {
        return JSON.parse(rawResponse);
    } catch {
        throw new AppError(`${fallbackMessage}: ${rawResponse.slice(0, 200)}`, 502);
    }
};
// دالة هنستعملها عشان نرتب الاوزران لاكتر الفنانين المشتركة مابين اليوزرز
const getTopItemsByWeight = (itemsArray , limit) => {
    const wieght = {};

    itemsArray.forEach(item =>{ 
        if (item) wieght[item] = (wieght[item] || 0) + 1;
    })

    return Object.entries(wieght)
    .sort((a , b) => b[1] - a[1])
    .slice(0 , limit)
    .map(item => item[0])
}

// دى الفانكشن اللى هنستعملها علشان نجيب الريكومنديشنز لليوزر فى الرروم
// export const generateRoomRecommendations = async (roomId , hostAccessToken) => {
//     const room = await Room.findById(roomId).populate('participants' , 'topArtists topTracks');
//     if(!room) throw new AppError('Room not found' , 404);

//     let allArtists = [];
//     let allTracks = [];

//     // هنجمع كل الاذواق فى مكان واحد عشان نشوف المشترك
//     room.participants.forEach(participant => {
//         if(participant && participant.topArtists) allArtists.push(...participant.topArtists);
//         if(participant && participant.topTracks) allTracks.push(...participant.topTracks);
//     })

//     const fetchOptions = {
//         headers: { 'Authorization': `Bearer ${hostAccessToken}` }
//     };

//     let finalTracksPool = [];

//     try {
//         // هنضيف الاغانى المشتركة مابين اليوزرز 
//         const topSharedTracks = getTopItemsByWeight(allTracks , 5);
//         if(topSharedTracks.length > 0){
//             const trackRes = await fetch(`${SPOTIFY_API_URL}/v1/tracks?ids=${topSharedTracks.join(',')}`, fetchOptions)
//             if(trackRes.ok){
//                 const tracksData = await trackRes.json();
//                 // حطينا ?. عشان لو tracks رجعت فاضية السيرفر ميقعش
//                 if (tracksData?.tracks) {
//                     finalTracksPool.push(...tracksData.tracks);
//                 }
//             }
//         }

//         // بعد كدا هنبدا نستنتج الفايب من الفنانين المشتركين ما بين اليوزرز
//         const topSharedArtists = getTopItemsByWeight(allArtists , 5);
//         let topGenres = [];

//         if(topSharedArtists.length > 0){
//             const artistsRes = await fetch(`${SPOTIFY_API_URL}/v1/artists?ids=${topSharedArtists.join(',')}`, fetchOptions);
//             if(artistsRes.ok){
//                 const artistsData = await artistsRes.json();
//                 let allGeneres = [];

//                 artistsData?.artists?.forEach(artist => {
//                     if(artist && artist.genres) allGeneres.push(...artist.genres);
//                 });
//                 // هنا بعد ماجبنا كل الفايبز اللى مابين الفنانين بنجيب اعلى اتنين مشتركين
//                 topGenres = getTopItemsByWeight(allGeneres , 2)
//             }
//         }

//         // بعد ماجيبنا العلى نجيب بقا المشترك بناء على ال genre  الاعلى دى
//         if(topGenres.length > 0){
//             // لو لقينا هنعمل بحث بناء على الاغاني
//             const genreQuery = topGenres.map(g => `genre:"${g}"`).join(' OR ');
//             const searchQuery = encodeURIComponent(`${genreQuery} year:2024-2026`);
            
//             const searchRes = await fetch(`${SPOTIFY_API_URL}/v1/search?q=${searchQuery}&type=track&market=EG&limit=15`, fetchOptions);
            
//             if (searchRes.ok) {
//                 const searchData = await searchRes.json();
//                 if (searchData?.tracks?.items) {
//                     finalTracksPool.push(...searchData.tracks.items);
//                 }
//             }
//         }

//         // بعد كدا بقا نبدا فى تجميع اللى عملناه دا كله ونعمل فلترة عشان مفيش حاجة تتكرر
//         const uniqueTracks = [];
//         const tracksIds = new Set();
//         for(const track of finalTracksPool){
//             if(track && track.id && !tracksIds.has(track.id)){
//                 tracksIds.add(track.id);
//                 uniqueTracks.push(track);
//             }
//         }

//         // بعد كدا نخلط الاغعانى اللى طلعت دى عشان نعمل ميكس حلو
//         for(let i = uniqueTracks.length - 1; i > 0; i--){
//             const j = Math.floor(Math.random() * (i + 1));
//             [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]]
//         }

//         // لو مفيش اغانى اتعملت يعنى رجع نتيجة فاضية 
//         if (uniqueTracks.length === 0) {
//             const fallbackQuery = encodeURIComponent('year:2024-2026');
//             const fallbackRes = await fetch(`${SPOTIFY_API_URL}/v1/search?q=${fallbackQuery}&type=track&market=EG&limit=20`, fetchOptions);
            
//             //  ضفنا شرط النجاح هنا عشان ميضربش لو سبوتيفاي رفض الريكويست
//             if (fallbackRes.ok) {
//                 const fallbackData = await fallbackRes.json();
//                 //  ?. هترجع المصفوفة أو فاضية لو مفيش داتا
//                 return fallbackData?.tracks?.items?.slice(0, 20) || [];
//             } else {
//                 return []; // نرجع فاضي أحسن ما نوقع السيرفر
//             }
//         }

//         // نرجع أول 20 أغنية
//         return uniqueTracks.slice(0, 20);
//     } catch (error) {
//         console.error("Vibe Engine Error:", error);
//         throw new AppError('Vibe Engine failed to generate tracks', 500);
//     }
// }


export const generateRoomRecommendations = async (roomId, hostAccessToken) => {
    const room = await Room.findById(roomId).populate('participants', 'topArtists topTracks');
    if (!room) throw new AppError('Room not found', 404);

    let allArtistIds = [];
    let allTrackIds  = [];
    // بجمع هنا كل الفنانين والتراكات الخاصة بكل اليوزرز فى الروم
    room.participants.forEach(participant => {
        if (participant?.topArtists) {
            const ids = participant.topArtists
                .map(a => typeof a === 'object' ? a?.id : a)
                .filter(Boolean);
            allArtistIds.push(...ids);
        }
        if (participant?.topTracks) {
            const ids = participant.topTracks
                .map(t => typeof t === 'object' ? t?.id : t)
                .filter(Boolean);
            allTrackIds.push(...ids);
        }
    });


    const fetchOptions = { headers: { 'Authorization': `Bearer ${hostAccessToken}` } };
    let token;
    // بتأد ان التوكن لسه مخلصش لو خلص بجدده
    const meRes = await fetch(`${SPOTIFY_API_URL}/v1/me`, fetchOptions);
    if (meRes.status === 401) token = await refreshSpotifyToken();
    // بجيب هنا الفنانين بالايدى والتراكات بردو
    const getArtist = async (id) => {
        const res = await fetch(`${SPOTIFY_API_URL}/v1/artists/${id}`, fetchOptions);
        if (!res.ok) return null;
        return res.json();
    };

    const getTrack = async (id) => {
        const res = await fetch(`${SPOTIFY_API_URL}/v1/tracks/${id}?market=EG`, fetchOptions);
        if (!res.ok) return null;
        return res.json();
    };
    // بعمل هنا بقا بحث ذكى وفتلر علشان نرجع التراكات
    const searchTracks = async (query, offset = 0) => {
        const res = await fetch(
            `${SPOTIFY_API_URL}/v1/search?q=${encodeURIComponent(query)}&type=track&market=EG&limit=10&offset=${offset}`,
            fetchOptions
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data?.tracks?.items?.filter(t => t !== null) ?? [];
    };

    try {
        // بجيب هنا اعلى  5 فنانين واعلى 3 اغانى
        const topArtistIds = getTopItemsByWeight(allArtistIds, 5);
        const topTrackIds  = getTopItemsByWeight(allTrackIds, 3);

        const startTime = Date.now();
        // بعمل هنا الاوبجكت عشان الريكوست اللى هبعته
        const artistObjects = await Promise.all(topArtistIds.map(getArtist));
        const validArtists  = artistObjects.filter(a => a !== null);


        // استخرج الـ genres
        let allGenres = [];
        // بجيب الفنانين التمام اللى رجعوا موجودين وبجيب ال genre بتاعتهم وبضيفها
        validArtists.forEach(artist => {
            if (artist?.genres?.length > 0) allGenres.push(...artist.genres);
        });
        // بستخرج هنا التوب من ال genres اللى اخترتهم
        const topGenres = getTopItemsByWeight(allGenres, 3);

        const searchStep = Date.now();

        const allPromises = [];
        // بجهز هنا الريكوست بالفنانين الموجودين والتوب
        validArtists.slice(0, 3).forEach(artist => {
            allPromises.push(searchTracks(`artist:"${artist.name}"`));
            allPromises.push(searchTracks(`artist:"${artist.name}"`, 10));
        });

        if (topGenres.length > 0) {
            const genreQuery = topGenres.map(g => `genre:"${g}"`).join(' OR ');
            allPromises.push(searchTracks(genreQuery));
            allPromises.push(searchTracks(genreQuery, 10));
        }

        topTrackIds.forEach(id => allPromises.push(getTrack(id)));
        // هنا برجع النتايج كلها اللى رجعت
        const allResults = await Promise.all(allPromises);

        // هنا بقا ببدا اصفى النتايج وافلتر واختار الاغانى المش متكررة
        let finalTracksPool = [];
        allResults.forEach(result => {
            if (!result) return;
            Array.isArray(result)
                ? finalTracksPool.push(...result)
                : finalTracksPool.push(result);
        });

        const uniqueTracks = [];
        const seenIds = new Set();
        for (const track of finalTracksPool) {
            if (track?.id && !seenIds.has(track.id)) {
                seenIds.add(track.id);
                uniqueTracks.push(track);
            }
        }

        for (let i = uniqueTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
        }


        if (uniqueTracks.length === 0) {
            const [fb1, fb2] = await Promise.all([
                searchTracks('year:2025-2026'),
                searchTracks('year:2025-2026', 10),
            ]);
            return [...fb1, ...fb2];
        }

        return uniqueTracks.slice(0, 20);

    } catch (error) {
        if (error instanceof AppError) throw error;
        console.error('[VibeEngine] Fatal error:', error);
        throw new AppError('Vibe Engine failed to generate tracks', 500);
    }
};

// الفانكشن المسئولة عن تجديد الريفرش توكن لليوزر لما ينتهى
export const refreshSpotifyToken = async (user) => {
    const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    // هنعمل بوست على سبوتيفاى علشان نجدد التوكن
    const response = await fetch('https://accounts.spotify.com/api/token' , {
        method: 'POST' ,
        headers: {
            'Authorization': `Basic ${authHeader}` ,
            'Content-Type': 'application/x-www-form-urlencoded'
        } ,
        body: new URLSearchParams({
            'grant_type': 'refresh_token' ,
            'refresh_token': user.refreshToken
        })
    });

    if(!response.ok){
        return next(new AppError('Something went wrong' , 500));
    }

    const data = await response.json();
    // بعد ما نجيب الداتا نحدثها فى الداتابيز
    user.accessToken = data.access_token;
    user.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    if(data.refresh_token) user.refreshToken = data.refresh_token;

    await user.save({validateBeforeSave: false});
    return user.accessToken;
}

// الفانكشن اللى هتجيب اذواق اليوزر من سبوتيقاى ونحفظها عندنا الفنانين والاغانى التوب عنده
export const syncUserPreferences = async (userId) => {
    try {
        const user = await User.findById(userId).select('+accessToken +refreshToken');
        if (!user) throw new AppError('User not found', 404);

        let token = user.accessToken;
        
        // لو التوكن خلص، نجدده
        if (Date.now() > new Date(user.tokenExpiresAt).getTime()) {
            // المفروض دالة refreshSpotifyToken بترجع التوكن الجديد
            token = await refreshSpotifyToken(user);
        }   

        const fetchOptions = {
            headers: { 'Authorization': `Bearer ${token}` }
        };

        const [artistsRes, tracksRes] = await Promise.all([
            fetch('https://api.spotify.com/v1/me/top/artists', fetchOptions),
            fetch('https://api.spotify.com/v1/me/top/tracks', fetchOptions)
        ]);

        if (!artistsRes.ok || !tracksRes.ok) throw new AppError('Failed to fetch top tracks and artists', 500);

        const artistsData = await artistsRes.json();
        const tracksData = await tracksRes.json();

        user.topArtists = artistsData.items.map(artist => artist.id);
        user.topTracks = tracksData.items.map(track => track.id);

        await user.save({ validateBeforeSave: false });
        console.log(`Preferences Sync for user ${user.displayName} completed`);
        
    } catch (error) {
        console.error(`Background sync failed for user ${userId}:`, error.message);
    }
}


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithThrottling = async (ids, endpointType, fetchOptions) => {
    const SPOTIFY_API_URL = "https://api.spotify.com";
    const results = [];
    const chunkSize = 4; 

    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (id) => {
            const res = await fetch(`${SPOTIFY_API_URL}/v1/${endpointType}/${id}${endpointType === 'tracks' ? '?market=EG' : ''}`, fetchOptions);
            
            if (res.status === 429) {
                const retryAfter = res.headers.get('Retry-After');
                console.error(`Rate limit hit for ${endpointType} ${id}!`);
                console.error(`Retrying after ${retryAfter} seconds...`);
                return null;
            }
            return res.ok ? res.json() : null;
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);

        if (i + chunkSize < ids.length) {
            await delay(300); 
        }
    }
    return results;
};

export const getFullLibraryDetails = async (userId) => {
    const user = await User.findById(userId).select('+accessToken +tokenExpiresAt topArtists topTracks displayName');
    if (!user) throw new AppError('User not found', 404);

    const cacheKey = `library:${user._id}`;
    const cachedLibrary = await redisClient.get(cacheKey);
    if (cachedLibrary) {
        console.log(`Getting Library From Cache for User ${user.displayName}`);
        return JSON.parse(cachedLibrary);
    }

    let token = user.accessToken;
    if (Date.now() > new Date(user.tokenExpiresAt).getTime()) {
        token = await refreshSpotifyToken(user);
    }

    const fetchOptions = {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const validArtistIds  = user.topArtists?.filter(Boolean) || [];
    const validTrackIds   = user.topTracks?.filter(Boolean)  || [];

    console.log(`Fetching ${validArtistIds.length} artists and ${validTrackIds.length} tracks with Throttling...`);

    // بنادي على الدالة الذكية لكل نوع
    const artistResults = await fetchWithThrottling(validArtistIds, 'artists', fetchOptions);
    const trackResults = await fetchWithThrottling(validTrackIds, 'tracks', fetchOptions);

    const fullArtists = artistResults.filter(Boolean);
    const fullTracks  = trackResults.filter(Boolean);

    console.log(`Got ${fullArtists.length} artists | ${fullTracks.length} tracks for ${user.displayName}`);

    const result = { artists: fullArtists, tracks: fullTracks };

    if (fullArtists.length > 0 || fullTracks.length > 0) {
        await redisClient.setEx(cacheKey, 86400, JSON.stringify(result));
    }

    return result;
};