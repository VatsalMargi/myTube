import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"; // fs is a file system that comes with nodejs for managing files
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
});

export const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto"
        })

        //file has been uploaded successfully
        console.log("file is uploaded on cloudinary", response.url);

        // Remove file after successful upload
        fs.unlinkSync(localFilePath, (err) => {
            if (err) console.error("Error deleting local file:", err);
        });
        
        return response;
    } catch (error) {
        // Remove file if upload fails
        if (fs.existsSync(localFilePath)) {
            fs.unlink(localFilePath, (err) => {
                if (err) console.error("Error deleting failed file:", err);
            });
        }

        return null;
    }
}
