import mongoose from "mongoose";

const productImageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    filename: { type: String, required: true }
}, { _id: true });

const productSchema = new mongoose.Schema({
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
    product: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    itemCode: { type: String, trim: true, default: "" },
    sellingType: { type: String, enum: ["Transactional", "Solution", "Subscription"], default: "Transactional" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory", default: null },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", default: null },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
    barcodeSymbology: { type: String, default: "CODE128" },
    description: { type: String, default: "" },
    taxType: { type: String, enum: ["Inclusive", "Exclusive", "None"], default: "Exclusive" },
    taxRate: { type: Number, default: 0, min: 0 },
    priceBeforeTax: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    priceAfterTax: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["Available", "Out of Stock", "Discontinued"], default: "Available" },
    images: [productImageSchema],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
