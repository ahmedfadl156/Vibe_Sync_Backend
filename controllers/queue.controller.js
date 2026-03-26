import QueueItem from "../models/queue.model.js";
import Room from "../models/rooms.model.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

export const addTrack = catchAsync(async (req , res , next) => {
    // هنجيب الايدى بتاع الروم وبيانات الاغنية
    const {roomId} = req.params;
    const {spotifyTrackId , trackData} = req.body;

    // نتأكد ان الوم موجودة ولسه شغالة
    const room = await Room.findById(roomId);

    if(!room || room.status === "closed"){
        return next(new AppError('Room not found or has been closed' , 404))
    }

    try {
        const newItem = await QueueItem.create({
            room: roomId,
            spotifyTrackId,
            trackData,
            score: 1,
            voters: [req.user._id]
        });

        // هنجيب هنا بردو السوكت ونقول ان فيه اغنيه جديدة اتضافت
        const io = req.app.get("io");

        io.to(roomId.toString()).emit('queue_updated' , {
            action: "add",
            track: newItem
        })

        res.status(201).json({
            status: "success",
            message: "Track added to queue",
            data: {
                queueItem: newItem
            }
        })
    } catch (error) {
        if(error.code === 11000){
            return next(new AppError("Track already exists in queue", 400));
        }
        throw error;
    }
})

export const voteTrack = catchAsync(async (req , res , next) => {
    const {queueItemId} = req.params;
    const userId = req.user._id;
    // هنجيب التراك نشوف اليوزر صوت قبل كدا ولا لا
    const track = await QueueItem.findById(queueItemId);

    if(!track){
        return next(new AppError("Track not found", 404));
    }

    // هنا بنشوف هو صوت ولا لا موجود فى القايمة بتاعت المصوتين ولا لا
    const hasVoted = track.voters.includes(userId);
    // هنا دول هنحدثهم بناء على حالة التصويت لليوزر
    let updateQuery;
    let message;

    if(hasVoted){
        updateQuery = {
            $pull: {voters: userId},
            $inc: {votes: -1}
        };
        message = "Vote removed";
    }else{
        updateQuery = {
            $addToSet: {voters: userId},
            $inc: {score: 1}
        };
        message = "Vote added"
    };
    // هنحدث بقا التراك بعد اما شوفنا وحدثنا حالة التصويت نبدا نطبق دا فى الداتابيز
    const updatedTrack = await QueueItem.findByIdAndUpdate(
        queueItemId,
        updateQuery,
        {new: true}
    ).populate('voters' , 'displayName avatar');

    // هنبدا هنا نسحب السوكت ونبعت تحديث للروم
    const io = req.app.get('io');
    io.to(updatedTrack.room.toString()).emit('queue_updated' , {
        action: 'vote',
        track: updatedTrack
    });

    res.status(200).json({
        status: 'success',
        message,
        data: updatedTrack
    })
})

export const getRoomQueue = catchAsync(async (req , res , next) => {
    const {roomId} = req.params;

    const queue = await QueueItem.find({
        room: roomId,
        status: {$in: ['pending' , 'playing']}
    }).sort({score: -1 , createdAt: 1}).populate('voters' , 'displayName avatar');

    res.status(200).json({
        status: 'success',
        results: queue.length,
        data: {queue}
    })
})