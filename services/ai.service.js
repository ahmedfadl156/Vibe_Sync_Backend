import { GoogleGenerativeAI } from "@google/generative-ai";
import AppError from "../utils/appError.js";
import dotenv from "dotenv";
dotenv.config({path: "config/.env"})

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const curatePlaylistWithAI = async (tracksPool , vibe , length , arabicCount , englishCount) => {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json"
            }
        })

        const prompt = `
        You are an expert Music Curator and DJ.
        I will provide you with a JSON list of available tracks (each has an id, name, and artist).
        Your task is to select exactly ${length} tracks from this list to create a playlist with a "${vibe}" vibe.
        
        CRITICAL RULES:
        1. Select exactly ${length} tracks.
        2. Mix Ratio: I need approximately ${arabicCount} AUTHENTIC Arabic tracks and ${englishCount} International tracks.
        3. AVOID FAKE ARABIC: Do NOT select instrumental, lounge, or oriental meditation tracks just because they have the word "Arabic" in the title (e.g., avoid "Arabic Chill", "Desert Rose", etc.).
        4. Look for actual Arab artist names (e.g., Wegz, Marwan Pablo, Afroto, Amr Diab, Cairokee, or names written in Arabic script).
        5. Ensure the tracks flow logically together for the given vibe.
        
        Return ONLY a flat JSON array of strings representing the selected track IDs. Example: ["id1", "id2"].
        
        Available Tracks:
        ${JSON.stringify(tracksPool)}
        `;

        console.log(`Sending ${tracksPool.length} tracks to Gemini AI for curation...`);
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // الـ AI هيرجع مصفوفة فيها الـ IDs جاهزة
        return JSON.parse(responseText);
    } catch (error) {
        console.error("AI Curation Error:", error);
        throw new AppError("AI engine failed to curate the playlist.", 500);
    }
}

export const getUserRoasted = async (lang , topArtists , topTracks) => {
    try {
    // نحدد اللغة
    const languageInstruction = lang === 'ar' ?
        "Speak directly to the user in funny, sarcastic Egyptian Arabic slang. (مهم جداً: إياك تستخدم لغة عربية فصحى، اتكلم بالعامية المصرية الروشة والسخرية القاسية)"
        : "Speak directly to the user in funny, sarcastic Gen-Z English slang."
        // نجهز البرومبت
        const prompt = `
        You are a brutal, hilarious, and sarcastic music critic. 
        Look at this user's current music taste:
        Top Artists: ${topArtists}
        Top Tracks: ${topTracks}

        1. Roast them mercilessly based on their taste. ${lang === 'ar' ? "Speak directly to the user in funny, sarcastic Egyptian Arabic slang." : "Speak directly to the user in funny, sarcastic Gen-Z English slang."}
        2. Find 2 or 3 tracks from their list that are weird, out of place, or embarrassing compared to the rest, and label them as 'Guilty Pleasures'.
        3. Suggest exactly 5 real songs (Song Name by Artist Name) as a 'Therapy Playlist' to fix their terrible taste.

        Output EXACTLY in the following JSON format without any markdown blocks or extra text:
        {
            "roastText": "Your hilarious brutal roast here",
            "guiltyPleasures": ["Track 1 name", "Track 2 name" , "Track 3 name"],
            "therapyPlaylist": ["Therapy Track 1", "Therapy Track 2", "Therapy Track 3", "Therapy Track 4", "Therapy Track 5"]
        }
        `;
        // نحدد المودل ونرجع الرد
        const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        // نظبط العلامات اللى رادعه نشيلها عشان الكلام يبقا طالع بشكل حلو
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const roastJson = JSON.parse(responseText);

        return roastJson;
    } catch (error) {
        console.error("AI Roast Error", error);
        throw new AppError("AI engine failed to roast you this time but don't worry try again", 500);
    }
}

export const getHispterMeterAI = async (artistsNames) => {
    try {
        // نجهز البرومبت
    const prompt = `
        You are an expert music data analyst with a sarcastic Egyptian persona.
        Analyze this list of artists: ${artistsNames}

        Task:
        1. Calculate the average mainstream score (0-100).
        2. Write a 2-sentence funny analysis in Egyptian Arabic explaining WHY they got this score based on the big names in their list.
        3. Identify the single MOST obscure/underground artist from this list.
        4. Write a 1-sentence sarcastic reason in Egyptian Arabic explaining why this specific artist is unknown.

        Output EXACTLY in JSON format:
        {
            "averageScore": 76,
            "tasteAnalysis": "إنت مقضيها عمالقة زي عمرو دياب ومنير، فنسبة التريند عندك ضربت في السما! مفيش أي ريسك في ذوقك.",
            "mostObscureArtistName": "Exact name from the list",
            "obscureReason": "A funny reason here"
        }
        `;

        // نحدد المودل وشكل الرد اللى هيرجع
        const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        const hispterMeterJson = JSON.parse(responseText);
        return hispterMeterJson;
    } catch (error) {
        console.error("AI Hipster Meter Error", error);
        throw new AppError("AI engine failed to analyze your hipster meter this time but don't worry try again", 500);
    }
}

export const getVibeMatchAnalysis = async (targetUserArtists , currentUserArtists  , currentUserName , targetUserName) => {
    try {
    const prompt = `
        You are a sarcastic but insightful music relationship guru. 
        Analyze the musical compatibility between User A and User B based on their top artists.

        ${targetUserName} (The Host) Top Artists: ${targetUserArtists}
        ${currentUserName} (The Guest) Top Artists: ${currentUserArtists}

        Task:
        1. Calculate a "Vibe Match Score" (0 to 100 percentage).
        2. Write a DETAILED, hilarious, and brutally honest analysis paragraph (around 4 to 5 sentences) of their relationship dynamic based purely on their music tastes. 
        - Dive deep into their personalities.
        - Imagine a scenario like them taking a road trip together and fighting over the Aux cord.
        - Use heavy Egyptian Arabic slang (سخرية مصرية روشة قاسية).
        - INJECT lots of expressive emojis (like 😭🔥💀😂🎧🚗💔) naturally throughout the text to give it soul and visual appeal.
        3. Suggest exactly 3 overlapping or complimentary artists that they BOTH would enjoy listening to together.

        Output EXACTLY in the following JSON format without any markdown blocks:
        {
            "matchScore": 85,
            "analysis": "Your detailed, emoji-filled Egyptian Arabic analysis here...",
            "commonGround": ["Artist 1", "Artist 2", "Artist 3" , "Artist 4"]
        }
        `;

        const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        const vibeMatchJson = JSON.parse(responseText);
        return vibeMatchJson;
    } catch (error) {
        console.error("AI Vibe Match Error", error);
        throw new AppError("AI engine failed to analyze your vibe match this time but don't worry try again", 500);
    }
}