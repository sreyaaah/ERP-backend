import Quotation from "../models/Quotation.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";


const stripHtml = (html = "") => html.replace(/<[^>]*>/g, "").trim();

/** Convert number to Indian words (e.g. 1120 → "One Thousand One Hundred Twenty Rupees Only") */
const numberToWords = (amount) => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const convert = (n) => {
        if (n === 0) return "";
        if (n < 20) return ones[n] + " ";
        if (n < 100) return tens[Math.floor(n / 10)] + " " + ones[n % 10] + " ";
        if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
        if (n < 100000) return convert(Math.floor(n / 1000)) + "Thousand " + convert(n % 1000);
        if (n < 10000000) return convert(Math.floor(n / 100000)) + "Lakh " + convert(n % 100000);
        return convert(Math.floor(n / 10000000)) + "Crore " + convert(n % 10000000);
    };

    const num = Math.round(amount);
    if (num === 0) return "Zero Rupees Only";
    return convert(num).trim() + " Rupees Only";
};

/** Compute line-item totals and grand total from items array */
const computeTotals = (items) => {
    let subtotal = 0;
    const computed = items.map((item) => {
        const rate = Number(item.rate) || 0;
        const qty = Number(item.qty) || 0;
        const discountPercent = Number(item.discountPercent) || 0;
        const taxPercent = Number(item.taxPercent) || 0;

        const discountAmt = (rate * discountPercent) / 100;
        const unitCost = rate - discountAmt;
        const taxAmount = (unitCost * taxPercent) / 100;
        const totalCost = (unitCost + taxAmount) * qty;

        subtotal += unitCost * qty;
        return { ...item, taxAmount: +taxAmount.toFixed(2), unitCost: +unitCost.toFixed(2), totalCost: +totalCost.toFixed(2) };
    });
    const grandTotal = computed.reduce((sum, i) => sum + i.totalCost, 0);
    return { items: computed, subtotal: +subtotal.toFixed(2), grandTotal: +grandTotal.toFixed(2) };
};

/** Format a Quotation document for API response */
const formatQuotation = (q, customer, productMap) => ({
    id: q._id,
    quotationNo: q.quotationNo,
    customerId: q.customerId,
    customerName: customer ? `${customer.firstName} ${customer.lastName || ""}`.trim() : "",
    customerAvatar: customer?.avatar || null,
    date: q.date,
    validity: q.validity,
    reference: q.reference,
    quotationType: q.quotationType,
    items: (q.items || []).map((item) => ({
        id: item._id,
        productId: item.productId,
        productName: productMap?.[item.productId?.toString()] || "",
        qty: item.qty,
        rate: item.rate,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        taxAmount: item.taxAmount,
        unitCost: item.unitCost,
        totalCost: item.totalCost
    })),
    subtotal: q.subtotal,
    grandTotal: q.grandTotal,
    amountInWords: q.amountInWords,
    description: q.description,
    status: q.status,
    convertedToSalesOrderId: q.convertedToSalesOrderId,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt
});

// 1. GET /api/quotations 
export const getQuotations = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            customerId,
            productId,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const query = {};

        if (status) query.status = status;
        if (customerId) query.customerId = customerId;

        // Search by quotation number or reference
        if (search) {
            const regex = { $regex: search, $options: "i" };
            // Also try to match customers by name
            const matchingCustomers = await Customer.find({
                $or: [
                    { firstName: regex },
                    { lastName: regex }
                ]
            }).select("_id");
            const customerIds = matchingCustomers.map((c) => c._id);

            query.$or = [
                { quotationNo: regex },
                { reference: regex },
                ...(customerIds.length > 0 ? [{ customerId: { $in: customerIds } }] : [])
            ];
        }

        if (productId) {
            query["items.productId"] = productId;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Quotation.countDocuments(query);

        const quotations = await Quotation.find(query)
            .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(Number(limit));

        // Populate customer info
        const customerIds = [...new Set(quotations.map((q) => q.customerId?.toString()))];
        const customers = await Customer.find({ _id: { $in: customerIds } });
        const customerMap = customers.reduce((acc, c) => { acc[c._id.toString()] = c; return acc; }, {});

        // Populate product names
        const allProductIds = [...new Set(quotations.flatMap((q) => q.items.map((i) => i.productId?.toString())))];
        const products = await Product.find({ _id: { $in: allProductIds } }).select("_id product");
        const productMap = products.reduce((acc, p) => { acc[p._id.toString()] = p.product; return acc; }, {});

        return res.status(200).json({
            message: "Quotations Retrieved Successfully",
            dataFound: quotations.length > 0,
            status: true,
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            totalRecords: total,
            data: quotations.map((q) => formatQuotation(q, customerMap[q.customerId?.toString()], productMap))
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

// 2. POST /api/quotations/add 
export const createQuotation = async (req, res) => {
    try {
        const {
            customerId, date, validity, reference,
            quotationType, description, status, items = []
        } = req.body;

        if (!customerId) return res.status(400).json({ message: "Customer is required", status: false });
        if (!date) return res.status(400).json({ message: "Date is required", status: false });
        if (!validity) return res.status(400).json({ message: "Validity is required", status: false });
        if (!items.length) return res.status(400).json({ message: "At least one item is required", status: false });

        const customer = await Customer.findById(customerId);
        if (!customer) return res.status(404).json({ message: "Customer not found", status: false });

        // Auto-generate quotation number: QT-YYYYMMDD-XXXX
        // Use the highest existing number for today's prefix to avoid duplicates after deletions
        const today = new Date();
        const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
        const prefix = `QT-${datePart}-`;

        const lastQ = await Quotation.findOne(
            { quotationNo: { $regex: `^${prefix}` } },
            { quotationNo: 1 }
        ).sort({ quotationNo: -1 }).lean();

        let seq = 1;
        if (lastQ) {
            const lastSeq = parseInt(lastQ.quotationNo.replace(prefix, ""), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }
        const quotationNo = `${prefix}${String(seq).padStart(4, "0")}`;

        const { items: computedItems, subtotal, grandTotal } = computeTotals(items);
        const amountInWords = numberToWords(grandTotal);

        const quotation = await Quotation.create({
            quotationNo,
            customerId,
            date,
            validity,
            reference: reference || "",
            quotationType: quotationType || "Intrastate",
            items: computedItems,
            subtotal,
            grandTotal,
            amountInWords,
            description: description || "",
            status: status || "Pending"
        });

        return res.status(201).json({
            message: "Quotation Created Successfully",
            dataFound: true,
            status: true,
            data: { id: quotation._id, quotationNo: quotation.quotationNo }
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//3. GET /api/quotations/:id 
export const getQuotationById = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found", status: false, dataFound: false });

        const customer = await Customer.findById(quotation.customerId);

        const allProductIds = quotation.items.map((i) => i.productId?.toString());
        const products = await Product.find({ _id: { $in: allProductIds } }).select("_id product");
        const productMap = products.reduce((acc, p) => { acc[p._id.toString()] = p.product; return acc; }, {});

        return res.status(200).json({
            message: "Quotation Retrieved Successfully",
            dataFound: true,
            status: true,
            data: formatQuotation(quotation, customer, productMap)
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//  4. PUT /api/quotations/update/:id 
export const updateQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found", status: false, dataFound: false });

        const {
            customerId, date, validity, reference,
            quotationType, description, status, items
        } = req.body;

        if (customerId) {
            const customer = await Customer.findById(customerId);
            if (!customer) return res.status(404).json({ message: "Customer not found", status: false });
            quotation.customerId = customerId;
        }

        if (date) quotation.date = date;
        if (validity) quotation.validity = validity;
        if (reference !== undefined) quotation.reference = reference;
        if (quotationType) quotation.quotationType = quotationType;
        if (description !== undefined) quotation.description = description;
        if (status) quotation.status = status;

        if (items && items.length > 0) {
            const { items: computedItems, subtotal, grandTotal } = computeTotals(items);
            quotation.items = computedItems;
            quotation.subtotal = subtotal;
            quotation.grandTotal = grandTotal;
            quotation.amountInWords = numberToWords(grandTotal);
        }

        await quotation.save();

        return res.status(200).json({
            message: "Quotation Updated Successfully",
            dataFound: true,
            status: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//  5. DELETE /api/quotations/delete/:id 
export const deleteQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found", status: false, dataFound: false });

        await quotation.deleteOne();

        return res.status(200).json({
            message: "Quotation Deleted Successfully",
            dataFound: true,
            status: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//  6. PATCH /api/quotations/:id/status 
export const updateQuotationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ["Pending", "Sent", "Ordered", "Converted"];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}`, status: false });
        }

        const quotation = await Quotation.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!quotation) return res.status(404).json({ message: "Quotation not found", status: false, dataFound: false });

        return res.status(200).json({
            message: "Quotation Status Updated Successfully",
            dataFound: true,
            status: true,
            data: { id: quotation._id, status: quotation.status }
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//  7. POST /api/quotations/bulk-delete 
export const bulkDeleteQuotations = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Please provide an array of IDs", status: false });
        }
        const result = await Quotation.deleteMany({ _id: { $in: ids } });
        return res.status(200).json({
            message: "Selected Quotations Deleted Successfully",
            dataFound: true,
            status: true,
            data: { requested: ids.length, deletedCount: result.deletedCount }
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//  8. POST /api/quotations/bulk-update 
export const bulkUpdateQuotations = async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Please provide an array of IDs", status: false });
        }
        if (!status) return res.status(400).json({ message: "Status is required", status: false });

        const result = await Quotation.updateMany({ _id: { $in: ids } }, { $set: { status } });
        return res.status(200).json({
            message: "Selected Quotations Updated Successfully",
            dataFound: true,
            status: true,
            data: { requested: ids.length, updatedCount: result.modifiedCount }
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false, dataFound: false });
    }
};

//  9. GET /api/quotations/:id/export/pdf 
export const exportSingleQuotationPdf = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found", status: false });

        const customer = await Customer.findById(quotation.customerId);

        const allProductIds = quotation.items.map((i) => i.productId?.toString());
        const products = await Product.find({ _id: { $in: allProductIds } }).select("_id product");
        const productMap = products.reduce((acc, p) => { acc[p._id.toString()] = p.product; return acc; }, {});

        const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => {
            const buffer = Buffer.concat(chunks);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=quotation-${quotation.quotationNo}.pdf`);
            res.send(buffer);
        });

        // Header
        doc.fontSize(22).font("Helvetica-Bold").fillColor("#fe9f43").text("DreamsPOS ERP", { align: "center" });
        doc.fontSize(11).font("Helvetica").fillColor("#666").text("Quotation", { align: "center" });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#eee").stroke();
        doc.moveDown();

        // Quotation meta
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333");
        const metaY = doc.y;
        doc.text(`Quotation No: ${quotation.quotationNo}`, 50, metaY);
        doc.text(`Date: ${new Date(quotation.date).toLocaleDateString()}`, 350, metaY);
        doc.text(`Validity: ${new Date(quotation.validity).toLocaleDateString()}`, 350, metaY + 18);
        doc.text(`Type: ${quotation.quotationType}`, 50, metaY + 18);
        if (quotation.reference) doc.text(`Reference: ${quotation.reference}`, 50, metaY + 36);
        doc.moveDown(3);

        // Customer info
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#333").text("Bill To:");
        doc.fontSize(10).font("Helvetica").fillColor("#555");
        if (customer) {
            doc.text(`${customer.firstName} ${customer.lastName || ""}`.trim());
            if (customer.email) doc.text(customer.email);
            if (customer.phone) doc.text(customer.phone);
            if (customer.address) doc.text(customer.address);
            if (customer.gstin) doc.text(`GSTIN: ${customer.gstin}`);
        }
        doc.moveDown();

        // Items table header
        const tableTop = doc.y + 10;
        const cols = { sno: 50, item: 90, qty: 270, rate: 310, disc: 360, tax: 405, unitCost: 445, total: 495 };

        doc.rect(45, tableTop, 510, 20).fill("#4472C4");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#fff");
        doc.text("#", cols.sno, tableTop + 5);
        doc.text("Item", cols.item, tableTop + 5, { width: 170 });
        doc.text("Qty", cols.qty, tableTop + 5);
        doc.text("Rate", cols.rate, tableTop + 5);
        doc.text("Disc%", cols.disc, tableTop + 5);
        doc.text("Tax%", cols.tax, tableTop + 5);
        doc.text("Unit Cost", cols.unitCost, tableTop + 5, { width: 45 });
        doc.text("Total", cols.total, tableTop + 5);

        let rowY = tableTop + 25;
        doc.font("Helvetica").fillColor("#333").fontSize(9);

        quotation.items.forEach((item, idx) => {
            if (rowY > 720) { doc.addPage(); rowY = 50; }
            if (idx % 2 === 0) doc.rect(45, rowY - 3, 510, 18).fill("#f9f9f9");

            doc.fillColor("#333");
            doc.text(`${idx + 1}`, cols.sno, rowY);
            doc.text(productMap[item.productId?.toString()] || "-", cols.item, rowY, { width: 170 });
            doc.text(`${item.qty}`, cols.qty, rowY);
            doc.text(`₹${item.rate}`, cols.rate, rowY);
            doc.text(`${item.discountPercent}%`, cols.disc, rowY);
            doc.text(`${item.taxPercent}%`, cols.tax, rowY);
            doc.text(`₹${item.unitCost}`, cols.unitCost, rowY, { width: 45 });
            doc.text(`₹${item.totalCost}`, cols.total, rowY);
            rowY += 20;
        });

        // Totals
        rowY += 10;
        doc.moveTo(350, rowY).lineTo(555, rowY).strokeColor("#ccc").stroke();
        rowY += 8;
        doc.fontSize(10).font("Helvetica").fillColor("#333");
        doc.text("Subtotal:", 370, rowY); doc.text(`₹${quotation.subtotal.toFixed(2)}`, 490, rowY);
        rowY += 18;
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
        doc.text("Grand Total:", 370, rowY); doc.text(`₹${quotation.grandTotal.toFixed(2)}`, 485, rowY);
        rowY += 18;
        doc.font("Helvetica").fontSize(9).fillColor("#555");
        doc.text(`Amount in Words: ${quotation.amountInWords}`, 50, rowY, { width: 500 });

        // Description
        if (quotation.description) {
            rowY += 25;
            doc.fontSize(10).font("Helvetica-Bold").fillColor("#333").text("Description:", 50, rowY);
            rowY += 15;
            doc.font("Helvetica").fontSize(9).fillColor("#555").text(stripHtml(quotation.description), 50, rowY, { width: 500 });
        }

        // Status
        doc.rect(50, doc.page.height - 80, 510, 22).fill("#f0f0f0");
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333")
            .text(`Status: ${quotation.status}`, 50, doc.page.height - 75, { align: "center" });

        // Footer
        doc.fontSize(8).fillColor("#aaa")
            .text("Generated by DreamsPOS ERP System", 50, doc.page.height - 50, { align: "center" });

        doc.end();
    } catch (error) {
        res.status(500).json({ message: error.message, status: false });
    }
};

//  10. GET /api/quotations/export/pdf 
export const exportQuotationsPdf = async (req, res) => {
    try {
        const quotations = await Quotation.find({}).sort({ createdAt: -1 });

        const customerIds = [...new Set(quotations.map((q) => q.customerId?.toString()))];
        const customers = await Customer.find({ _id: { $in: customerIds } });
        const customerMap = customers.reduce((acc, c) => { acc[c._id.toString()] = c; return acc; }, {});

        const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, bufferPages: true });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => {
            const buffer = Buffer.concat(chunks);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=quotations-${Date.now()}.pdf`);
            res.send(buffer);
        });

        doc.fontSize(20).font("Helvetica-Bold").fillColor("#fe9f43").text("DreamsPOS ERP – Quotation List", { align: "center" });
        doc.fontSize(9).font("Helvetica").fillColor("#666").text(`Generated: ${new Date().toLocaleDateString()}`, { align: "right" });
        doc.moveDown();

        const tTop = doc.y;
        const cols = { sno: 30, no: 60, customer: 160, date: 280, validity: 340, type: 410, total: 490, status: 570 };

        doc.rect(25, tTop, 790, 20).fill("#4472C4");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#fff");
        doc.text("#", cols.sno, tTop + 5);
        doc.text("Quotation No", cols.no, tTop + 5);
        doc.text("Customer", cols.customer, tTop + 5, { width: 110 });
        doc.text("Date", cols.date, tTop + 5);
        doc.text("Validity", cols.validity, tTop + 5);
        doc.text("Type", cols.type, tTop + 5);
        doc.text("Grand Total", cols.total, tTop + 5);
        doc.text("Status", cols.status, tTop + 5);

        let rowY = tTop + 24;
        doc.font("Helvetica").fillColor("#333").fontSize(9);

        const statusColors = { Converted: "#27c59a", Sent: "#27c59a", Ordered: "#f0ad4e", Pending: "#999" };

        quotations.forEach((q, i) => {
            if (rowY > 530) { doc.addPage({ size: "A4", layout: "landscape", margin: 40 }); rowY = 50; }
            if (i % 2 === 0) doc.rect(25, rowY - 3, 790, 18).fill("#f9f9f9");

            const customer = customerMap[q.customerId?.toString()];
            const custName = customer ? `${customer.firstName} ${customer.lastName || ""}`.trim() : "-";

            doc.fillColor("#333");
            doc.text(`${i + 1}`, cols.sno, rowY);
            doc.text(q.quotationNo, cols.no, rowY, { width: 95 });
            doc.text(custName, cols.customer, rowY, { width: 110, ellipsis: true });
            doc.text(new Date(q.date).toLocaleDateString(), cols.date, rowY);
            doc.text(new Date(q.validity).toLocaleDateString(), cols.validity, rowY);
            doc.text(q.quotationType, cols.type, rowY);
            doc.text(`₹${q.grandTotal.toFixed(2)}`, cols.total, rowY);
            doc.fillColor(statusColors[q.status] || "#333").text(q.status, cols.status, rowY);

            rowY += 20;
        });

        // Page numbers
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor("#aaa").text(`Page ${i + 1} of ${pages.count}`, 40, doc.page.height - 30, { align: "center" });
        }
        doc.end();
    } catch (error) {
        res.status(500).json({ message: error.message, status: false });
    }
};

//  11. GET /api/quotations/export/xlsx 
export const exportQuotationsXlsx = async (req, res) => {
    try {
        const quotations = await Quotation.find({}).sort({ createdAt: -1 });

        const customerIds = [...new Set(quotations.map((q) => q.customerId?.toString()))];
        const customers = await Customer.find({ _id: { $in: customerIds } });
        const customerMap = customers.reduce((acc, c) => { acc[c._id.toString()] = c; return acc; }, {});

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet("Quotations");

        ws.columns = [
            { header: "S.No", key: "sno", width: 7 },
            { header: "Quotation No", key: "quotationNo", width: 22 },
            { header: "Customer", key: "customer", width: 25 },
            { header: "Date", key: "date", width: 15 },
            { header: "Validity", key: "validity", width: 15 },
            { header: "Type", key: "type", width: 15 },
            { header: "Reference", key: "reference", width: 18 },
            { header: "Subtotal (₹)", key: "subtotal", width: 16 },
            { header: "Grand Total (₹)", key: "grandTotal", width: 18 },
            { header: "Amount Words", key: "amountInWords", width: 40 },
            { header: "Status", key: "status", width: 13 },
            { header: "Created At", key: "createdAt", width: 18 }
        ];

        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

        quotations.forEach((q, i) => {
            const customer = customerMap[q.customerId?.toString()];
            const custName = customer ? `${customer.firstName} ${customer.lastName || ""}`.trim() : "-";

            ws.addRow({
                sno: i + 1,
                quotationNo: q.quotationNo,
                customer: custName,
                date: q.date ? new Date(q.date).toLocaleDateString() : "-",
                validity: q.validity ? new Date(q.validity).toLocaleDateString() : "-",
                type: q.quotationType,
                reference: q.reference || "-",
                subtotal: q.subtotal,
                grandTotal: q.grandTotal,
                amountInWords: q.amountInWords,
                status: q.status,
                createdAt: q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "-"
            });
        });

        ws.autoFilter = { from: "A1", to: "L1" };

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=quotations-${Date.now()}.xlsx`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ message: error.message, status: false });
    }
};

//  12. GET /api/quotations/generate-number 
export const generateQuotationNumber = async (req, res) => {
    try {
        const today = new Date();
        const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
        const prefix = `QT-${datePart}-`;

        const lastQ = await Quotation.findOne(
            { quotationNo: { $regex: `^${prefix}` } },
            { quotationNo: 1 }
        ).sort({ quotationNo: -1 }).lean();

        let seq = 1;
        if (lastQ) {
            const lastSeq = parseInt(lastQ.quotationNo.replace(prefix, ""), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }
        const quotationNo = `${prefix}${String(seq).padStart(4, "0")}`;

        return res.status(200).json({
            message: "Quotation Number Generated Successfully",
            quotationNo,
            status: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false });
    }
};

//  13. POST /api/quotations/:id/convert 
export const convertQuotationToInvoice = async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) return res.status(404).json({ message: "Quotation not found", status: false, dataFound: false });

        if (quotation.status === "Converted") {
            return res.status(400).json({ message: "Quotation has already been converted", status: false });
        }

        // Mark as converted — Sales Order / Invoice creation can be wired here when that module exists
        quotation.status = "Converted";
        // Placeholder: future SalesOrder model can be created here and its ID stored
        const salesOrderId = null; // Replace with actual SalesOrder._id when implemented

        quotation.convertedToSalesOrderId = salesOrderId;
        await quotation.save();

        return res.status(200).json({
            message: "Quotation Converted Successfully",
            salesOrderId,
            status: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message, status: false });
    }
};
