import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js";
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens= async(userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username,  email 
    // upload them to cloudinary, avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check user creation
    // return res

    const {fullName, email, userName, password}= req.body;

    if (
        [fullName, email, userName, password].some((field)=> field?.trim()==="")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existingUser = await User.findOne({
        $or: [{userName},{email}]
    })

    if(existingUser){
        throw new ApiError(409, "User with email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    console.log(req.files);
    if(!avatarLocalPath){
        throw new ApiError(409, "avatar is required")
    }

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage[0].path){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverimage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverimage?.url || "",
        email,
        password,
        userName: userName.toLowerCase()

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registring the User")
    };

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    );
})
const loginUser = asyncHandler(async (req,res)=>{
    //get the user info from frontend
    //check if user exists
    //if exist -> password check
    //password checked -> generate access and refresh token and send it to user through cookies
    //give response as per the result of the upper step

    const {email, userName,password} = req.body
    if(!userName && !email){
        throw new ApiError(400, "username or email required")
    }

    const user = await User.findOne({
        $or:[{userName},{email}]
    })

    if(!user){
        throw new ApiError(400,"User does not exist")
    }

    const isPasswordValid= await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken}=await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",
    accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, 
                accessToken,
                refreshToken
            },
            "User logged in SuccessFully"
        )
    )


    


})
const logoutUser = asyncHandler(async (req,res)=>{
    const user = await User.findByIdAndUpdate(
        req.user._id,   
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200,{},"User logged out successfully"))
})
const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token ")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used ")
        }
    
        const options = {
            httpOnly: true,
            seccure:true
        }
    
        const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id);
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, 
                    refreshToken: newrefreshToken
                },
                "Access Token refreshed"
            )
        )   
    } catch (error) {
        throw new ApiError(500, error?.message || "Internal Server error")
    }

})
const changeCurrentPassword = asyncHandler(async(req,res)=>{
    try {
        const {oldPassword, newPassword} = req.body
    
        const user = await User.findById(req.user?._id)
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    
        if(!isPasswordCorrect){
            throw new ApiError(400, "Invalid old Password");
    
        }
        user.password = newPassword;
    
        await user.save({validateBeforeSave: false})
    
        return res
        .status(200)
        .json(new ApiResponse(200,{},'Password Changed Successfully'))
    } catch (error) {
        throw new ApiError(500,"Password change was not successful")
    }

})
const getCurrentUser = asyncHandler(async(req,res)=>{
    const user = req?.user;
    if(!user){
        throw new ApiError(500, "Error getting the user");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"User Fetched Successfully")
    )
})
const updateAccountDetails = asyncHandler(async(req,res)=>{
    try {
    
        const {fullName, email} = req.body;
    
        if(!fullName || !email){
            throw new ApiError(400,"All fields are required")
        }
    
        const user = User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    fullName,
                    email
                }
            },
            {new: true}//if this is true you will be returned the new updated information
            ).select("-password")
    
            return res
            .status(200)
            .json(new ApiResponse(200,user,"User Updated Successfully"))
        } catch (error) {
            throw new ApiError(500, "Error Updating User")
        }
})
const updateUserAvatar = asyncHandler(async(req,res)=>{
    try {
        const avatarLocalPath = req.file?.path
    
        if(!avatarLocalPath){
            throw new ApiError(400, "Avatar file is missing")
        }
    
        const avatar = await uploadOnCloudinary(avatarLocalPath)
    
        if(!avatar.url){
            throw new ApiError(500, "Error while uploading avatar")
        }
        const user = await User.findById(req.user?._id).select("avatar");
        const updatedUser = await User.findByIdAndUpdate(
            
            req.user?._id,
            {
                $set:{
                    avatar: avatar.url
                }
            },
            {new: true}
            ).select("-password -refreshToken")
            // TODO: delete utitlity after uploading the new image
            deleteFromCloudinary(user?.avatar);

        return res
        .status(200)
        .json(new ApiResponse(200,updatedUser,"Avatar updated successfully"))
    } catch (error) {
        throw new ApiError(500,"Error while updating the avatar")
    }
    
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    try {
        const coverImageLocalPath = req.file?.path
    
        if(!coverImageLocalPath){
            throw new ApiError(400, "Avatar file is coverImage")
        }
    
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
        if(!coverImage.url){
            throw new ApiError(500, "Error while uploading coverImage")
        }
        const user = await User.findById(req.user?._id).select("coverImage");
        const updatedUser = await User.findByIdAndUpdate(
    
            req.user?._id,
            {
                $set:{
                    coverImage: coverImage.url
                }
            },
            {new: true}
        ).select("-password -refreshToken")
     // TODO: delete utitlity after uploading the new image
        deleteFromCloudinary(user?.coverImage);
     
        return res
        .status(200)
        .json(new ApiResponse(200,updatedUser,"coverImage updated successfully"))
    } catch (error) {
        throw new ApiError(500,"Error while updating the coverImage")
    }
    
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {userName} = req.params

    if(!userName?.trim()){
        throw new ApiError(404,"user Not Found")
    }

    const channel = await User.aggregate([
        {
            $match:{
                userName: userName?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id,"subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName: 1,
                userName: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }

    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel not Found")
    }


    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User Channel fetched Succesfully")
    )

})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate({
        $match:{
            _id: new mongoose.Types.ObjectId(req.user._id)
        },     
        $lookup: {
            from:"videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline:[
                {
                    $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"owner",
                        pipeline:[
                            {
                                $project:{
                                    fullName:1,
                                    userName:1,
                                    avatar:1 
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields:{
                        owner:{
                            $first:"$owner"
                        }
                    }
                }
            ] 
        }
        
    })

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch History Fetched Successfully"
        )
    )
})


export {registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar,updateUserCoverImage, getUserChannelProfile,getWatchHistory}