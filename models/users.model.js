import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    spotifyId: {
        type: String,
        required: true,
        unique: true,
    },
    displayName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    avatar: {
        type: String,
    },
    accountType: {
        type: String,
        required: true,
        enum: ['premium', 'free' , 'open'],
        default: 'free'
    },
    topArtists: {
        type: [String],
    },
    topTracks:  {
        type: [String],
    },
    generatedVibes: [
        {
            playlistId: String,
            playlistName: String,
            playlistUrl: String,
            vibe: String,
            trackCount: Number,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    musicRoast: {
        roastText: String,
        guiltyPleasures: [String],
        therapyPlaylist: [String],
        language: {
            type: String,
            enum: ['ar' , 'en'],
            default: 'ar'
        },
        generatedAt: Date
    },
    hipsterMeter: {
        mainStreamScore: Number,
        hipsterScore: Number,
        badge: String,
        badgeDescription: String,
        proof: Object,
        generatedAt: Date
    },
    vibeMatches: [
        {
            targetUserId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            matchScore: Number,
            analysis: String,
            commonGround: [String],
            generatedAt: Date
        }
    ],
    lastSyncedAt: Date,
    accessToken: {
        type: String,
        select: false
    },
    refreshToken: { 
        type: String,
        select: false
    },
    tokenExpiresAt: Date,
}, {timestamps: true})

export const User = mongoose.model('User', userSchema);
export default  User;