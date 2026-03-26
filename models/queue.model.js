import mongoose from "mongoose";

const queueItemSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true
    },
    spotifyTrackId: {
        type: String,
        required: true
    },
    trackData: {
        name: {type: String , required: true},
        artistName: {type: String , required: true},
        albumArtUrl: {type: String},
        durationMs: {type: Number}
    },
    score: {
        type: Number,
        default: 0
    },
    voters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    status: {
        type: String,
        enum: ["pending", "playing", "played"],
        default: "pending"
    }
}, {timestamps: true})

queueItemSchema.index({room: 1 , status: 1 , score: -1})

queueItemSchema.index({room: 1 , spotifyTrackId: 1 , status: 1} , {unique: true})

export const QueueItem = mongoose.model("QueueItem", queueItemSchema)
export default QueueItem;