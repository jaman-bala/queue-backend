const mongoose = require('mongoose');

export const connectDB = async () => {
    try {
        if (process.env.DB_URI) {
            await mongoose.connect(process.env.DB_URI);
        }
    } catch (err) {
        console.log(err);
    }
};
