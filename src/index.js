import { app } from "./app.js";
import connectDB from "./db/index.js";

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.error(`ERR : ${error}`);
        throw error
    })

    app.listen(process.env.PORT || 8000,() => {
        let onPort = process.env.PORT || 8000;
        console.log(`Server listening on port ${onPort}`);
    })
})
.catch((err)=>{
    console.log("MongoDB connection failed !!!", err);
})
