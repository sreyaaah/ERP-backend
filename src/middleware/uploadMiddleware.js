import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const customerUploadsDir = path.join(__dirname, "../../uploads/customers");
if (!fs.existsSync(customerUploadsDir)) {
    fs.mkdirSync(customerUploadsDir, { recursive: true });
}

const brandUploadsDir = path.join(__dirname, "../../uploads/brands");
if (!fs.existsSync(brandUploadsDir)) {
    fs.mkdirSync(brandUploadsDir, { recursive: true });
}

const productUploadsDir = path.join(__dirname, "../../uploads/products");
if (!fs.existsSync(productUploadsDir)) {
    fs.mkdirSync(productUploadsDir, { recursive: true });
}

const csvUploadsDir = path.join(__dirname, "../../uploads/csv");
if (!fs.existsSync(csvUploadsDir)) {
    fs.mkdirSync(csvUploadsDir, { recursive: true });
}

// Configure storage for customers
const customerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, customerUploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// Configure storage for brands
const brandStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, brandUploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
    }
};

// Configure multer for customers
export const uploadCustomerImage = multer({
    storage: customerStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: fileFilter
});

// Configure multer for brands
export const uploadBrandImage = multer({
    storage: brandStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: fileFilter
});

// Product image storage & uploader 
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, productUploadsDir); },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

export const uploadProductImage = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// CSV storage & uploader 
const csvStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, csvUploadsDir); },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `import-${uniqueSuffix}.csv`);
    }
});

const csvFileFilter = (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
        cb(null, true);
    } else {
        cb(new Error("Only CSV files are allowed"));
    }
};

export const uploadCsv = multer({
    storage: csvStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: csvFileFilter
});

// Helper function to delete old image
export const deleteCustomerImage = (filename) => {
    try {
        const fullPath = path.join(customerUploadsDir, filename);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (error) {
        // Silent fail
    }
};

export const deleteBrandImage = (filename) => {
    try {
        const fullPath = path.join(brandUploadsDir, filename);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (error) {
        // Silent fail
    }
};

export const deleteProductImage = (filename) => {
    try {
        const fullPath = path.join(productUploadsDir, filename);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (error) {
        // Silent fail
    }
};

