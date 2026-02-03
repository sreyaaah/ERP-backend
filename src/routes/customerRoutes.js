import express from "express";
import {
  getCustomers,
  addCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,
  bulkDeleteCustomers,
  bulkUpdateCustomers,
  exportCustomers
} from "../controllers/customerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getCustomers);
router.post("/add", protect, addCustomer);
router.get("/export", protect, exportCustomers);

router.post("/bulk-delete", protect, bulkDeleteCustomers);
router.post("/bulk-update", protect, bulkUpdateCustomers);

router.get("/:id", protect, getCustomerById);
router.put("/:id", protect, updateCustomer);
router.patch("/:id/status", protect, toggleCustomerStatus);
router.delete("/:id", protect, deleteCustomer);

export default router;
