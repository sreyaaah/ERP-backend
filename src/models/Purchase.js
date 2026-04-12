import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
    {
        purchaseNumber: { type: String, unique: true },
        supplierName: { type: String, trim: true, required: [true, "Supplier name is required"] },
        date: { type: Date, required: true, default: Date.now },
        reference: { type: String, trim: true, default: "" },
        status: {
            type: String,
            enum: ["received", "pending"],
            default: "pending"
        },
        orderTax: { type: Number, required: [true, "Tax type is required"], default: 0 }, 
        discount: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        grandTotal: { type: Number, required: [true, "Grand total is required"], default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        paymentStatus: {
            type: String,
            enum: ["Paid", "Unpaid", "Partially Paid"],
            default: "Unpaid"
        }
    },
    { timestamps: true }
);

// Middleware to calculate dueAmount and paymentStatus before saving
purchaseSchema.pre("save", function (next) {
    this.dueAmount = (this.grandTotal || 0) - (this.paidAmount || 0);
    
    if (this.paidAmount >= this.grandTotal && this.grandTotal > 0) {
        this.paymentStatus = "Paid";
    } else if (this.paidAmount > 0) {
        this.paymentStatus = "Partially Paid";
    } else {
        this.paymentStatus = "Unpaid";
    }
    next();
});

// Indexes for performance
purchaseSchema.index({ createdAt: 1 });
purchaseSchema.index({ paymentStatus: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;
