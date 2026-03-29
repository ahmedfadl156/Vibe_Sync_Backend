import catchAsync from "../utils/catchAsync.js";
import Room from "../models/rooms.model.js";
import { customAlphabet } from "nanoid";
import AppError from "../utils/appError.js";
import User from "../models/users.model.js";
import { generateRoomRecommendations, refreshSpotifyToken } from "../services/spotify.service.js";
import QueueItem from "../models/queue.model.js";

const generateNanoId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

const generateRoomCode = () => {
    return `AF-${generateNanoId()}`;
};

export const createRoom = catchAsync(async (req , res , next) => {
    const { name , isPublic , roomLimit } = req.body;

    if(!name){
        return next(new AppError("Please select a name for the room" , 400));
    }

    const existingRoom = await Room.findOne({
        host: req.user._id,
        status: {$in: ['waiting' , 'active']}
    });

    if(existingRoom){
        return res.status(200).json({
            status: "success",
            message: "You already have a room",
            data: {
                room: existingRoom
            }
        });
    }

    let roomCode = generateRoomCode();
    let isUnique = false;

    while(!isUnique){
        const existingCode = await Room.findOne({roomCode});
        if(!existingCode){
            isUnique = true;
        }else{
            console.log(`Collision detected for room code ${roomCode} , regenerating...`);
            roomCode = generateRoomCode();
        }
    }

    const newRoom = await Room.create({
        roomName: name,
        isPublic: isPublic !== undefined ? isPublic : true,
        roomLimit: roomLimit || 10,
        roomCode: roomCode,
        host: req.user._id,
        participants: [req.user._id],
        vibeSettings: {
            totalEnergy: req.body.totalEnergy || 0.5,
            genres:  req.body.genres || [],
        }
    });

    try {
        const spotifyTracks = await generateRoomRecommendations(newRoom._id , req.spotifyToken);

        const queueItems = spotifyTracks.map(track => ({
            room: newRoom._id,
            spotifyTrackId: track.id,
            trackData: {
                name: track.name,
                artistName: track.artists.map(a => a.name).join(', '),
                albumArtUrl: track.album.images[0]?.url || '',
                durationMs: track.duration_ms
            },
            score: 0,
            voters: [],
            status: 'pending'
        }));

        await QueueItem.insertMany(queueItems);
    } catch (error) {
        console.error(error);
    }

    res.status(201).json({
        status: "success",
        message: "Room created successfully",
        data: {
            room: newRoom
        }
    });
});

export const joinRoom = catchAsync(async (req , res , next) => {
    const {roomCode} = req.params;

    const room = await Room.findOne({
        roomCode: roomCode.toUpperCase(),
        status: {$in: ['waiting' , 'active']}
    });

    if(!room){
        return next(new AppError("Room not found", 404));
    }

    const isAlreadyParticipant = room.participants.includes(req.user._id);

    if(!isAlreadyParticipant && room.participants.length >= room.roomLimit){
        return next(new AppError(`Room is full! Maximum capacity is ${room.roomLimit} vibers`, 400));
    }

    const updatedRoom = await Room.findOneAndUpdate(
        room._id,
        {
            $addToSet: {participants: req.user._id}
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    ).populate('host' , 'displayName avatar').populate('participants' , 'displayName avatar');

    const io = req.app.get("io");

    if (!isAlreadyParticipant) {
        io.to(updatedRoom._id.toString()).emit('user_joined' , {
            user:{
                _id: req.user._id,
                displayName: req.user.displayName,
                avatar: req.user.avatar
            },
            message: `${req.user.displayName} Joined the vibe!`
        });

        try {
            const host = await User.findById(updatedRoom.host).select('+accessToken +refreshToken +tokenExpiresAt');
            if (!host) {
                throw new AppError("Host user not found", 404);
            }

            let hostToken = host.accessToken;
            if (Date.now() > new Date(host.tokenExpiresAt).getTime()) {
                hostToken = await refreshSpotifyToken(host);
            }

            const newSpotifyTracks = await generateRoomRecommendations(updatedRoom._id , hostToken);

            const existingQueue = await QueueItem.find({ room: updatedRoom._id , status: 'pending' }).select('spotifyTrackId');
            const existingTrackIds = existingQueue.map(q => q.spotifyTrackId);

            const freshTracks = newSpotifyTracks
                .filter(track => !existingTrackIds.includes(track.id))
                .slice(0, 5)
                .map(track => ({
                room: updatedRoom._id,
                spotifyTrackId: track.id,
                trackData: {
                    name: track.name,
                    artistName: track.artists.map(a => a.name).join(', '),
                    albumArtUrl: track.album.images[0]?.url || '',
                    durationMs: track.duration_ms
                },
                score: 0,
                status: 'pending'
            }));

            if(freshTracks.length > 0){
                await QueueItem.insertMany(freshTracks);

                const unvotedTracks = await QueueItem.find({
                    room: updatedRoom._id,
                    status: 'pending',
                    score: 0
                }).select('_id');

                for(let i = unvotedTracks.length - 1; i > 0; i--){
                    const j = Math.floor(Math.random() * (i + 1));
                    [unvotedTracks[i], unvotedTracks[j]] = [unvotedTracks[j], unvotedTracks[i]];
                }

                const bulkOps = unvotedTracks.map((track , index) => ({
                    updateOne: {
                        filter: { _id: track._id },
                        update: { $set: { createdAt: new Date(Date.now() + index * 1000) } }
                    }
                }));

                if(bulkOps.length > 0){
                    await QueueItem.bulkWrite(bulkOps);
                }

                io.to(updatedRoom._id.toString()).emit('queue_updated', {
                    action: 'shuffle',
                    message: 'New vibes added and mixed!'
                });
            }
        } catch (error) {
            console.error("Failed to update queue for new user:", error);
        }
    }

    res.status(200).json({
        status: "success",
        message: isAlreadyParticipant ? "Rejoined room successfully" : "Room joined successfully",
        data: {
            room: updatedRoom
        }
    });
});

export const getPublicRooms = catchAsync(async (req , res , next) => {
    const publicRooms = await Room.find({
        isPublic: true,
        status: {$in: ['waiting' , 'active']}
    })
    .populate('host' , 'displayName avatar')
    .populate('participants' , 'avatar')
    .sort('-createdAt')
    .limit(50);

    res.status(200).json({
        status: 'success',
        results: publicRooms.length,
        data: publicRooms
    });
});

export const leaveRoom = catchAsync(async (req , res , next) => {
    const {roomCode} = req.params;

    const room = await Room.findOneAndUpdate(
        {
            roomCode: roomCode.toUpperCase(),
            status: {$in: ['waiting' , 'active']}
        },
        {
            $pull: {participants: req.user._id}
        },{
            returnDocument: "after"
        }
    );

    if(!room){
        return next(new AppError("Room not found", 404));
    }

    const io = req.app.get("io");

    io.to(room._id.toString()).emit("user_left" , {
        userId: req.user._id,
        message: `${req.user.displayName} left the vibe`
    });

    if(room.participants.length === 0){
        room.state = "closed";
        await room.save();
    }

    res.status(200).json({
        status: "success",
        message: "Left room successfully"
    });
});

export const closeRoom = catchAsync(async (req , res , next) => {
    const {roomCode} = req.params;

    const room = await Room.findOneAndUpdate(
        {
            roomCode: roomCode.toUpperCase(),
            host: req.user._id,
            status: {$in: ['waiting' , 'active']}
        },
        {
            status: "closed"
        },
        {
            returnDocument: "after"
        }
    );

    if(!room){
        return next(new AppError('Room not found' , 404));
    }

    const io = req.app.get("io");
    io.to(room._id.toString()).emit('room_closed' , {
        message: "The host has ended the vibe. Hope you enjoyed it!"
    });

    res.status(200).json({
        status: "success",
        message: "Room closed successfully"
    });
});
