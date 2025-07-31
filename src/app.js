import express from  "express";
import cors from "cors"
// to perform crud on cookies of user browser from server
import cookieParser from "cookie-parser";
const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

/**
 * Handling the json data
 * Setting the size limit of json data to 16kb
 */
app.use(express.json({limit:"16kb"}))
/**
 * Handling the data from url
 * Making extended true will let us send nested objects in the url
 * Setting the size limit of the url data
 */
app.use(express.urlencoded({extended: true, limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes import
import userRouter from "./routes/user.routes.js"


//routes declaration
app.use("/api/v1/users",userRouter)
export {app}