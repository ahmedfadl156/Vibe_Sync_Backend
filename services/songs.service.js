import dotenv from "dotenv";
dotenv.config({path: "config/.env"})
import { getLyrics } from "genius-lyrics-api";
import lyricsFinder from "lyrics-finder";
// الفانكشن اللى هتجيب الكلمات من LRCLIB
const fetchFromLrclib = async (artist , track) => {
    try {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`;
        const res = await fetch(url);
        if(!res.ok){
            console.log("Error fetching from Lrclib" + res.status + res.statusText);
            return null;
        }
        const data = await res.json();
        return data.plainLyrics ? {lyrics: data.plainLyrics , source: 'lrclib'} : null;
    } catch (error) {
        console.log(error);
        return null;
    }
}

// هنا لو الاولى فشلت هنجيب من GENUIS
const fetchFromGenius = async (artist , track) => {
    try {
        const options = {
            apiKey: process.env.GENIUS_ACCESS_TOKEN,
            title: track,
            artist: artist,
            optimizeQuery: true
        };

        const lyrics = await getLyrics(options);
        return lyrics ? {lyrics , source: 'genius'} : null;
    } catch (error) {
        console.error("Genius API Error:", error);
        return null;
    }
}

const fetchFromLyricsFinder = async (artist , track) => {
    try {
        const lyrics = await lyricsFinder(artist , track);
        return lyrics ? {lyrics , source: 'lyrics-finder'} : null;
    } catch (error) {
        console.error("Lyrics Finder Error:", error);
        return null;
    }
}



// دى الفانكشن اللى الكنترولر هيكلمها وتلف على كل دول
export const findLyricsWithFallback = async (artist, track) => {
    const strategies = [
        fetchFromLrclib,
        fetchFromGenius,
        fetchFromLyricsFinder,
    ];

    for(const strategy of strategies){ 
        const result = await strategy(artist, track);
        if(result && result.lyrics){
            return result;
        }
    }

    return null;
}