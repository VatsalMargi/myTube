/**
 * This is a higher-order function that wraps an async function. If the wrapped function throws an error, it catches it and sends a JSON response like { success: false, message: '...' } with the appropriate HTTP status code set using res.status(...).
 * @param {inner function} fn function that we will run inside the wrapper
 * 
 */

const asyncHandler = (fn) => { return async(req, res, next)=>{
    try {
        return await fn(req, res, next)
    } catch (error) {
         res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}}


export {asyncHandler}