import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

const Store = mongoose.model("Store", storeSchema);
export default Store;
