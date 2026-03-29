import AppError from "../utils/appError.js";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/me/player";

// الفانكشن اللى هتهندل الايرورز علشان ترجعلنا كلام مفهوم
const handleSpotifyPlayerError = async (res) => {
    if(res.ok) return;

    let errorData;

    try {
        errorData = await res.json();
    } catch (error) {
        errorData = {error: {message: "Unknown Spotify Error"}}
    }

    const status = res.status;
    const message = errorData.error?.message || "Failed to control playback";
    const reason = errorData.error?.reason || "Unknown";

    if(status === 403){
        throw new AppError("Spotify premium is required to play tracks." , 403);
    }
    if(status === 404 || reason === "NO_ACTIVE_DEVICE"){
        throw new AppError("No active device found., Please open spotify on your laptop or phone first" , 404);
    }

    throw new AppError(`Spotify Error: ${message}` , status);
}

// الفانكشن المسئولة عن تشغيل الاغنية
export const playTrackOnSpotify = async (token , trackUri , positionMs = 0 , deviceId = null) => {
    // لو باعتين جهاز معين نشغل عليه بنحطه فى الرابط
    const url = deviceId ? `${SPOTIFY_API_URL}/play?device_id=${deviceId}` : `${SPOTIFY_API_URL}/play`;

    const res = await fetch(url , {
        method: "PUT",
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uris: [trackUri],
            position_ms: positionMs
        })
    });

    await handleSpotifyPlayerError(res);
    return true;
}

// الفانكشن المسئولة عن اننا نوقف اغنية
export const pauseTrackOnSpotify = async (token , deviceId = null) => {
    const url = deviceId ? `${SPOTIFY_API_URL}/pause?device_id=${deviceId}` : `${SPOTIFY_API_URL}/pause`;

    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    await handleSpotifyPlayerError(res);
    return true;
}
// الفانكشن المسئولة عن اننا نقدم اغنية لوقت معين
export const seekTrackOnSpotify = async (token, positionMs, deviceId = null) => {
    const url = deviceId ? 
        `${SPOTIFY_API_URL}/seek?position_ms=${positionMs}&device_id=${deviceId}` : 
        `${SPOTIFY_API_URL}/seek?position_ms=${positionMs}`;

    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    await handleSpotifyPlayerError(res);
    return true;
};