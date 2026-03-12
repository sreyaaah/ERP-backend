import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import customerRoutes from "./routes/customerRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";

import subcategoryRoutes from "./routes/subcategoryRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import warrantyRoutes from "./routes/warrantyRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import dropdownRoutes from "./routes/dropdownRoutes.js";
import quotationRoutes from "./routes/quotationRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import bankAccountRoutes from "./routes/bankAccountRoutes.js";
import taxRoutes from "./routes/taxRoutes.js";
import currencyRoutes from "./routes/currencyRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Serve static files (uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Existing module routes
app.use("/api/customers", customerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/warranties", warrantyRoutes);

// Product module
app.use("/api/products", productRoutes);

// Quotation module
app.use("/api/quotations", quotationRoutes);

// Invoice module
app.use("/api/invoices", invoiceRoutes);

// Bank account module
app.use("/api/bank-accounts", bankAccountRoutes);

// Tax module
app.use("/api/taxes", taxRoutes);

// Currency module
app.use("/api/currencies", currencyRoutes);

// Purchase module
app.use("/api/purchases", purchaseRoutes);

// Dropdown data for product form
app.use("/api", dropdownRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    status: false,
    dataFound: false
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

