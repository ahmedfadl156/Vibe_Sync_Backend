import catchAsync from "../utils/catchAsync.js";
import Room from "../models/rooms.model.js"
import { customAlphabet } from "nanoid";
import AppError from "../utils/appError.js";
import User from "../models/users.model.js";
import { generateRoomRecommendations } from "../services/spotify.service.js";
import QueueItem from "../models/queue.model.js";

const generateNanoId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);
// هنا هنعمل الدالة اللى بتولد الكود بتاع الروم اللى هتتعمل
const generateRoomCode = () => {
    return `AF-${generateNanoId()}`
}

export const createRoom = catchAsync(async (req , res , next) => {
    // هناخد اسم الروم وهل هيا public ولا لا 
    const { name , isPublic , roomLimit } = req.body;

    if(!name){
        return next(new AppError("Please select a name for the room" , 400))
    }

    // اول حاجة قبل مانعمل كرييت نشوف اليوزر دا اصلا عنده روم تانيه عاملها وشغالة
    const existingRoom = await Room.findOne({
        host: req.user._id,
        status: {$in: ['waiting' , 'active']}
    })

    // لو لقيت فعلا روم معموله ارجعه للروم اللى هو عاملها
    if(existingRoom){
        return res.status(200).json({
            status: "success",
            message: "You already have a room",
            data: {
                room: existingRoom
            }
        })
    };

    // لو مفيش هنعمل كود علشان نعمل روم جديدة
    let roomCode = generateRoomCode();
    let isUnique = false;

    // هنا بنتأ:د ان الكود دا مش موجود قبل كدا
    while(!isUnique){
        const existingCode = await Room.findOne({roomCode})
        if(!existingCode){
            isUnique = true;
        }else{
            console.log(`Collision detected for room code ${roomCode} , regenerating...`);
            roomCode = generateRoomCode();
        }
    }

    // بعد كدا نعمل الروم الجديدة
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

    // هنجيب التوكن بتاع الهوست عشان هنبعته لسبوتيفاى عشان الترشيحات
    const host = await User.findById(req.user._id).select('+accessToken');

    try {
        const spotifyTracks = await generateRoomRecommendations(newRoom._id , host.accessToken);
        
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
    })
})

export const joinRoom = catchAsync(async (req , res , next) => {
    // بنجيب الكود بتاعت الروم اللى اليوزر عايز يخشها
    const {roomCode} = req.params;

    // نجيب الروم الاول عشان نشوف عدد اللى فيها
    const room = await Room.findOne({
        roomCode: roomCode.toUpperCase(),
        status: {$in: ['waiting' , 'active']}
    });

    if(!room){
        return next(new AppError("Room not found", 404));
    }

    // نشوف هل اليوزر دا موجود اصلا جوا الروم
    const isAlreadyParticipant = room.participants.includes(req.user._id);

    if(!isAlreadyParticipant && room.participants.length >= room.roomLimit){
        return next(new AppError(`Room is full! Maximum capacity is ${room.roomLimit} vibers`, 400));
    }
    // نبدا ان احنا ندور على الروم دى عندنا نشوفها موجودة وشغاله ولا لا
    // لو موجودة بنضيف اليوزر للروم ونبدا نظهر اسمه وصورته
    const updatedRoom = await Room.findOneAndUpdate(
        room._id,
        {
            $addToSet: {participants: req.user._id} // هتضيفه لو مش موجود بس
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    ).populate('host' , 'displayName avatar').populate('participants' , 'displayName avatar');

    // هنا هنجيب السوكت ونقول ان فيه يوزر جديد دخل الروم 
    const io = req.app.get("io");
    
    if (!isAlreadyParticipant) {
        // نبعت اشعار ان فيه يوزر دخل
        io.to(updatedRoom._id.toString()).emit('user_joined' , {
            user:{
                _id: req.user._id,
                displayName: req.user.displayName,
                avatar: req.user.avatar
            },
            message: `${req.user.displayName} Joined the vibe!`
        });
try {
            // هنجيب توكن الهوست علشان نبعت لسبوتيفاى
            const host = await User.findById(updatedRoom.host).select('+accessToken');

            // بعدين نحدث الالجورزيم اللى بتجيب الاغانى بعد لما اليوزر يدخل
            const newSpotifyTracks = await generateRoomRecommendations(updatedRoom._id , host.accessToken);
            
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
                // نحفظهم فى الداتابيز
                await QueueItem.insertMany(freshTracks);

                // هنجيب الاغانى اللى فى الروم لسه ما اخدتش تصويت علشان نرتبهم نعملهم shuffle
                const unvotedTracks = await QueueItem.find({
                    room: updatedRoom._id,
                    status: 'pending',
                    score: 0
                }).select('_id');

                // نعملهم ميكس shuffle
                for(let i = unvotedTracks.length - 1; i > 0; i--){
                    const j = Math.floor(Math.random() * (i + 1));
                    [unvotedTracks[i], unvotedTracks[j]] = [unvotedTracks[j], unvotedTracks[i]];
                }

                // ندى لكل الاغانى وقت جديد عشان يرتبهم بناء على الميكس اللى عملناه
                const bulkOps = unvotedTracks.map((track , index) => ({
                    updateOne: {
                        filter: { _id: track._id },
                        update: { $set: { createdAt: new Date(Date.now() + index * 1000) } }                    
                    }
                })); 
                
                if(bulkOps.length > 0){
                    await QueueItem.bulkWrite(bulkOps);
                }

                // نبعت إشعار واحد بس للفرونت إند إنه يعمل ريفريش للطابور
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
    })
})

// دى الفانكشن اللى هتجيب كل الرومات ال public علشان اليوزر يقدروا يشاركوا بعض
export const getPublicRooms = catchAsync(async (req , res , next) => {
    // هنشوف الرومات البابليك واللى لسه شغالة
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
    })
})

// الفانكشن المسئولة عن ان الضيوف يخرجوا برا الروم
export const leaveRoom = catchAsync(async (req , res , next) => {
    const {roomCode} = req.params;

    // هندور على الروم زنشيل اليوزر من المشاركين فى الروم
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
    };

    // هنبعت الاشعار باسلوكت ان فى يوزر قفل
    const io = req.app.get("io");

    io.to(room._id.toString()).emit("user_left" , {
        userId: req.user._id,
        message: `${req.user.displayName} left the vibe`
    });

    // لو دا كان اخر واحد فى الروم هنخلى حالة الروم مقفولة
    if(room.participants.length === 0){
        room.state = "closed";
        await room.save();
    }

    res.status(200).json({
        status: "success",
        message: "Left room successfully"
    });
})

// الفانكشن اللى هتبقى للادمن المسئولة عن انه يقفل الروم خلاص
export const closeRoom = catchAsync(async (req , res , next) => {
    const {roomCode} = req.params;

    // هنجيب الروم اللى الهوست عايز يقفلها
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
    })
})