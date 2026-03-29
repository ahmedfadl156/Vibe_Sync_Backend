import crypto from "crypto";
import catchAsync from "../utils/catchAsync.js";
import User from "../models/users.model.js";
import AppError from "../utils/appError.js";
import jwt from "jsonwebtoken";
import { getFullLibraryDetails, syncUserPreferences } from "../services/spotify.service.js";

const parseJsonResponse = async (response, fallbackMessage) => {
    const rawResponse = await response.text();

    try {
        return JSON.parse(rawResponse);
    } catch {
        throw new AppError(`${fallbackMessage}: ${rawResponse}`, 502);
    }
};

const generateRandomString = (length) => {
    return crypto.randomBytes(60).toString('hex').slice(0 , length);
};

export const getMe = async (req , res , next) => {
    try {
        const id = req.user._id;
        const user = await User.findById(id);

        if(!user){
            return next(new AppError('User not found' , 404));
        }

        res.status(200).json({
            status: 'success',
            data: user
        });
    } catch (error) {
        console.log(error);
    }
};

export const getToken = catchAsync(async (req, res, next) => {
    res.status(200).json({
        status: 'success',
        accessToken: req.spotifyToken
    });
});

export const getMyLibrary = async (req , res , next) => {
    const libraryData = await getFullLibraryDetails(req.user._id);
    if(!libraryData){
        return next(new AppError('User not found' , 404));
    }
    res.status(200).json({
        status: 'success',
        data: libraryData
    });
};

export const login = (req , res) => {
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email user-top-read playlist-modify-public playlist-modify-private user-modify-playback-state user-read-playback-state streaming';
    const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: scope,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        state: state,
        show_dialog: true
    });

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie('spotify_auth_state', state, {
        maxAge: 15 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
};

export const callback = catchAsync(async (req , res , next) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

    if(state === null || state !== storedState){
        return res.redirect(`${process.env.CLIENT_URL}/error?msg=state_mismatch`);
    }
    res.clearCookie('spotify_auth_state', { path: '/' });

    const authHeader = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token' , {
        method: "POST",
        body: new URLSearchParams({
            code: code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            grant_type: 'authorization_code'
        }),
        headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const tokenData = await parseJsonResponse(
        tokenResponse,
        'Spotify token endpoint returned a non-JSON response'
    );

    if(!tokenResponse.ok){
        throw new AppError(tokenData.error_description || 'Failed to get Spotify tokens', tokenResponse.status);
    }

    const {access_token, refresh_token, expires_in} = tokenData;
    const userProfileResponse = await fetch('https://api.spotify.com/v1/me' , {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    });

    const spotifyUser = await parseJsonResponse(
        userProfileResponse,
        'Spotify profile endpoint returned a non-JSON response'
    );

    if(!userProfileResponse.ok){
        throw new AppError(spotifyUser.error?.message || 'Failed to get Spotify user profile', userProfileResponse.status);
    }

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    const user = await User.findOneAndUpdate(
        {spotifyId: spotifyUser.id},
        {
            spotifyId: spotifyUser.id,
            displayName: spotifyUser.display_name,
            email: spotifyUser.email,
            avatar: spotifyUser.images.length > 0 ? spotifyUser.images[0].url : undefined,
            accountType: spotifyUser.product,
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenExpiresAt: tokenExpiresAt
        },
        {new: true , upsert: true}
    );

    const vibeToken = jwt.sign(
        {userId: user._id},
        process.env.JWT_SECRET,
        {expiresIn: '7d'}
    );

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie('vibe_session' , vibeToken , {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });
    syncUserPreferences(user._id);
    res.redirect(`${process.env.CLIENT_URL}`);
});

export const logout = (req , res) => {
    res.cookie('vibe_session' , "loggedout" , {
        expires: new Date(Date.now() + 1 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
    });

    res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
    });
};
