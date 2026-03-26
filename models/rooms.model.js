import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    roomName: {
        type: String,
        required: true,
        trim: true
    },
    roomCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    roomLimit: {
        type: Number,
        min: [1 , "The room limit must be at least 1"],
        max: [10 , "The room limit must be at most 10"],
        default: 5,
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    vibeSettings: {
        totalEnergy: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },
        genres: {
            type: [String],
            default: []
        }
    },
    status: {
        type: String,
        enum: ["waiting" , "active" , "closed"],
        default: "waiting"
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})

roomSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export const Room = mongoose.model("Room" , roomSchema);
export default Room;