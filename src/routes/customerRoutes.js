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
// TEMPORARILY COMMENTED OUT FOR TESTING - Uncomment when auth is ready
// import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// AUTHENTICATION TEMPORARILY DISABLED FOR TESTING
// Add back 'protect' middleware when authentication is implemented
router.get("/", getCustomers);
router.post("/add", addCustomer);
router.get("/export", exportCustomers);

router.post("/bulk-delete", bulkDeleteCustomers);
router.post("/bulk-update", bulkUpdateCustomers);

router.get("/:id", getCustomerById);
router.put("/:id", updateCustomer);
router.patch("/:id/status", toggleCustomerStatus);
router.delete("/:id", deleteCustomer);

export default router;
