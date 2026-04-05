import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    gstin: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

const Store = mongoose.model("Store", storeSchema);
export default Store;
