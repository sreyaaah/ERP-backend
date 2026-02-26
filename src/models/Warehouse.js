import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

const Warehouse = mongoose.model("Warehouse", warehouseSchema);
export default Warehouse;
