import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import customerRoutes from "./routes/customerRoutes.js";

dotenv.config(); // Load env variables

const app = express();

// Connect MongoDB
connectDB();

// Middleware
app.use(express.json());

// Routes

app.use("/api/customers", customerRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
