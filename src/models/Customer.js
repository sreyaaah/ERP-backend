import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    gstin: String,
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);
