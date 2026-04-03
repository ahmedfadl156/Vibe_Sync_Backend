import mongoose from "mongoose";

const songLyricsSchema = new mongoose.Schema({
    trackId: { 
        type: String, 
        required: [true, 'Track ID is required'], 
        unique: true,
        index: true 
    }, 
    artistName: { type: String, required: true },
    trackName: { type: String, required: true },
    lyrics: { type: String, required: true },
    aiAnalysis: { type: String }, 
    source: { 
        type: String, 
        enum: ['lrclib', 'genius', 'lyrics-finder', 'gemini', 'user_submission'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved' 
    },
    submittedBy: { 
        type: mongoose.Schema.ObjectId, 
        ref: 'User' 
    },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 }
}, { timestamps: true });

const SongLyrics = mongoose.model("SongLyrics" , songLyricsSchema);
export default SongLyrics;