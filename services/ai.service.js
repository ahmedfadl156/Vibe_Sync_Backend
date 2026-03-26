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