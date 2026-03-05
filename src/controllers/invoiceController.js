import Invoice from "../models/Invoice.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

/** Helper to compute totals */
const computeTotals = (items) => {
    let subtotal = 0;
    let taxAmount = 0;

    const computedItems = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate) || 0;
        const discount = Number(item.discount) || 0;
        const taxPercent = Number(item.taxPercent) || 0;

        const baseAmount = qty * rate;
        const amountAfterDiscount = baseAmount - discount;
        const itemTax = (amountAfterDiscount * taxPercent) / 100;
        const itemTotal = amountAfterDiscount + itemTax;

        subtotal += amountAfterDiscount;
        taxAmount += itemTax;

        return {
            ...item,
            amount: +itemTotal.toFixed(2)
        };
    });

    const grandTotal = subtotal + taxAmount;
    return {
        items: computedItems,
        subtotal: +subtotal.toFixed(2),
        taxAmount: +taxAmount.toFixed(2),
        grandTotal: +grandTotal.toFixed(2)
    };
};

// 1. GET /api/invoices
export const getInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, customerId, sortBy } = req.query;
        const query = {};

        if (status) query.paymentStatus = status;
        if (customerId) query.customerId = customerId;
        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
                {
                    $expr: {
                        $regexMatch: {
                            input: { $toString: "$grandTotal" },
                            regex: search,
                            options: "i"
                        }
                    }
                },
                {
                    $expr: {
                        $regexMatch: {
                            input: { $dateToString: { format: "%Y-%m-%d", date: "$dueDate" } },
                            regex: search,
                            options: "i"
                        }
                    }
                }
            ];
        }

        if (sortBy === 'lastMonth') {
            const date = new Date();
            date.setMonth(date.getMonth() - 1);
            query.invoiceDate = { $gte: date };
        } else if (sortBy === 'last7') {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            query.invoiceDate = { $gte: date };
        }

        let sortOptions = { createdAt: -1 };
        if (sortBy === 'asc') sortOptions = { invoiceDate: 1 };
        else if (sortBy === 'desc') sortOptions = { invoiceDate: -1 };

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Invoice.countDocuments(query);
        const invoices = await Invoice.find(query)
            .populate("customerId", "firstName lastName")
            .sort(sortOptions)
            .skip(skip)
            .limit(Number(limit));

        const formattedData = invoices.map(inv => ({
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName || (inv.customerId ? `${inv.customerId.firstName} ${inv.customerId.lastName}`.trim() : "Walk-in Customer"),
            invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
            dueDate: inv.dueDate.toISOString().split('T')[0],
            grandTotal: inv.grandTotal,
            paidAmount: inv.paidAmount || 0,
            amountDue: inv.amountDue,
            paymentStatus: inv.paymentStatus,
            invoiceType: inv.invoiceType
        }));

        return res.status(200).json({
            status: true,
            message: "Invoices fetched successfully",
            totalRecords: total,
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            data: formattedData
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// 2. GET /api/invoices/:id
export const getInvoiceById = async (req, res) => {
    try {
        const inv = await Invoice.findById(req.params.id).populate("customerId");
        if (!inv) return res.status(404).json({ status: false, message: "Invoice not found" });

        const data = {
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            invoiceType: inv.invoiceType,
            customer: {
                customerId: inv.customerId?._id,
                name: inv.customerName || (inv.customerId ? `${inv.customerId.firstName} ${inv.customerId.lastName}`.trim() : "N/A"),
                email: inv.customerEmail || inv.customerId?.email || "",
                phone: inv.customerPhone || inv.customerId?.phone || "",
                address: inv.customerAddress || inv.customerId?.address || "",
                gstin: inv.customerGstin || inv.customerId?.gstin || ""
            },
            invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
            dueDate: inv.dueDate.toISOString().split('T')[0],
            paymentStatus: inv.paymentStatus,
            items: inv.items.map((item, index) => ({
                itemId: index + 1,
                productName: item.productName,
                quantity: item.quantity,
                rate: item.rate,
                discount: item.discount,
                taxPercent: item.taxPercent,
                amount: item.amount
            })),
            subtotal: inv.subtotal,
            taxAmount: inv.taxAmount,
            grandTotal: inv.grandTotal,
            paidAmount: inv.paidAmount || 0,
            notes: inv.notes,
            terms: inv.terms
        };

        return res.status(200).json({ status: true, data });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// 3. POST /api/invoices/add
export const createInvoice = async (req, res) => {
    try {
        const {
            invoiceType, customerId,
            customerName, customerEmail, customerPhone, customerAddress, customerGstin,
            invoiceDate, dueDate, paymentStatus, paidAmount, items, notes, terms
        } = req.body;

        const totals = computeTotals(items);

        // Auto-gen number if not provided
        const today = new Date();
        const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
        const prefix = `INV-${datePart}-`;
        const lastInv = await Invoice.findOne({ invoiceNumber: { $regex: `^${prefix}` } }).sort({ invoiceNumber: -1 });
        let seq = 1;
        if (lastInv) {
            const lastSeq = parseInt(lastInv.invoiceNumber.split('-').pop(), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }
        const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;

        const newInvoice = await Invoice.create({
            invoiceNumber,
            invoiceType: invoiceType || "Intrastate",
            customerId,
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            customerGstin,
            invoiceDate: invoiceDate || today,
            dueDate,
            paymentStatus: paymentStatus || "Unpaid",
            paidAmount: Number(paidAmount) || 0,
            items: totals.items,
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            grandTotal: totals.grandTotal,
            notes,
            terms
        });

        return res.status(201).json({
            status: true,
            message: "Invoice created successfully",
            invoiceId: newInvoice._id,
            invoiceNumber: newInvoice.invoiceNumber
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// 4. PUT /api/invoices/update/:id
export const updateInvoice = async (req, res) => {
    try {
        const { items, ...rest } = req.body;
        let updateData = { ...rest };

        if (items) {
            const totals = computeTotals(items);
            updateData.items = totals.items;
            updateData.subtotal = totals.subtotal;
            updateData.taxAmount = totals.taxAmount;
            updateData.grandTotal = totals.grandTotal;
        }

        const updated = await Invoice.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updated) return res.status(404).json({ status: false, message: "Invoice not found" });

        return res.status(200).json({
            status: true,
            message: "Invoice updated successfully"
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// 5. DELETE /api/invoices/delete/:id
export const deleteInvoice = async (req, res) => {
    try {
        const deleted = await Invoice.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ status: false, message: "Invoice not found" });

        return res.status(200).json({
            status: true,
            message: "Invoice deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// 6. GET /api/invoices/generate-number
export const generateInvoiceNumber = async (req, res) => {
    try {
        const today = new Date();
        const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
        const prefix = `INV-${datePart}-`;
        const lastInv = await Invoice.findOne({ invoiceNumber: { $regex: `^${prefix}` } }).sort({ invoiceNumber: -1 });
        let seq = 1;
        if (lastInv) {
            const lastSeq = parseInt(lastInv.invoiceNumber.split('-').pop(), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }
        const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;

        return res.status(200).json({
            status: true,
            invoiceNumber
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// Update Status Utility
export const updateInvoiceStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await Invoice.findByIdAndUpdate(req.params.id, { paymentStatus: status }, { new: true });
        if (!updated) return res.status(404).json({ status: false, message: "Invoice not found" });

        return res.status(200).json({
            status: true,
            message: "Status updated successfully"
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// Bulk Delete
export const bulkDeleteInvoices = async (req, res) => {
    try {
        const { invoiceIds } = req.body;
        await Invoice.deleteMany({ _id: { $in: invoiceIds } });
        return res.status(200).json({
            status: true,
            message: "Selected invoices deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// Bulk Update
export const bulkUpdateInvoices = async (req, res) => {
    try {
        const { invoiceIds, status } = req.body;
        await Invoice.updateMany({ _id: { $in: invoiceIds } }, { paymentStatus: status });
        return res.status(200).json({
            status: true,
            message: "Statuses updated successfully"
        });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// Export Bulk PDF
export const exportInvoicesPdf = async (req, res) => {
    try {
        const invoices = await Invoice.find().populate("customerId").sort({ createdAt: -1 });
        const doc = new PDFDocument({ margin: 40 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=invoices.pdf");
        doc.pipe(res);

        // Title
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#ff9f43').text("Invoice Report", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#666666').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: "center" });
        doc.moveDown(2);

        // Colors
        const tableColor = '#1a202c';
        const headerColor = '#f8f9fa';
        const borderColor = '#e2e8f0';

        // Table settings
        const tableTop = doc.y;
        const defaultFontSize = 10;

        const col1 = 40;   // Invoice No
        const col2 = 140;  // Customer
        const col3 = 300;  // Date
        const col4 = 390;  // Status
        const col5 = 480;  // Total

        // Header Background
        doc.rect(40, tableTop - 5, 520, 25).fill(headerColor);

        // Header Text
        doc.font("Helvetica-Bold").fontSize(defaultFontSize).fillColor(tableColor);
        doc.text("Invoice No", col1, tableTop + 2);
        doc.text("Customer", col2, tableTop + 2);
        doc.text("Date", col3, tableTop + 2);
        doc.text("Status", col4, tableTop + 2);
        doc.text("Grand Total", col5, tableTop + 2, { width: 80, align: "right" });

        // Header Bottom Border
        doc.moveTo(40, tableTop + 20).lineTo(560, tableTop + 20).lineWidth(1).strokeColor(borderColor).stroke();

        let y = tableTop + 30;
        doc.font("Helvetica").fontSize(defaultFontSize);

        invoices.forEach((inv, i) => {
            // Check page overflow
            if (y > doc.page.height - 80) {
                doc.addPage();
                y = 50;

                // Redraw Header
                doc.rect(40, y - 5, 520, 25).fill(headerColor);
                doc.font("Helvetica-Bold").fillColor(tableColor);
                doc.text("Invoice No", col1, y + 2);
                doc.text("Customer", col2, y + 2);
                doc.text("Date", col3, y + 2);
                doc.text("Status", col4, y + 2);
                doc.text("Grand Total", col5, y + 2, { width: 80, align: "right" });
                doc.moveTo(40, y + 20).lineTo(560, y + 20).lineWidth(1).strokeColor(borderColor).stroke();
                y += 30;
                doc.font("Helvetica").fillColor(tableColor);
            }

            const customerName = inv.customerName || (inv.customerId ? `${inv.customerId.firstName} ${inv.customerId.lastName}` : "Walk-in");
            const amtStr = `${inv.invoiceType === 'International' ? '$' : 'Rs.'}${Number(inv.grandTotal).toFixed(2)}`;

            doc.fillColor(tableColor);
            doc.text(inv.invoiceNumber, col1, y);
            doc.text(customerName.substring(0, 25), col2, y);
            doc.text(inv.invoiceDate.toISOString().split('T')[0], col3, y);

            // Status with color
            let statusColor = '#3b82f6'; // primary
            if (inv.paymentStatus === 'Paid') statusColor = '#22c55e'; // green
            else if (inv.paymentStatus === 'Unpaid') statusColor = '#ef4444'; // red
            else if (inv.paymentStatus === 'Overdue') statusColor = '#f59e0b'; // orange

            doc.fillColor(statusColor).text(inv.paymentStatus, col4, y);
            doc.fillColor(tableColor).text(amtStr, col5, y, { width: 80, align: "right" });

            y += 20;
            // Row bottom line
            doc.moveTo(40, y - 5).lineTo(560, y - 5).lineWidth(0.5).strokeColor(borderColor).stroke();
            y += 5;
        });

        // Summary box
        doc.moveDown(2);
        y = doc.y;
        if (y > doc.page.height - 120) {
            doc.addPage();
            y = 50;
        }

        const totalInvoices = invoices.length;
        const totalValue = invoices.reduce((acc, inv) => acc + (inv.grandTotal || 0), 0);

        doc.rect(380, y, 180, 60).fillColor('#f8f9fa').fill();
        doc.rect(380, y, 180, 60).strokeColor(borderColor).stroke();

        doc.font("Helvetica-Bold").fontSize(11).fillColor(tableColor);
        doc.text("Summary", 395, y + 10);
        doc.font("Helvetica").fontSize(10);
        doc.text(`Total Invoices: ${totalInvoices}`, 395, y + 28);
        doc.text(`Total Value: ${totalValue.toFixed(2)}`, 395, y + 42);

        doc.end();
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// Export Bulk Excel
export const exportInvoicesXlsx = async (req, res) => {
    try {
        const invoices = await Invoice.find().populate("customerId").sort({ createdAt: -1 });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Invoices");

        sheet.columns = [
            { header: "Invoice No", key: "invoiceNumber", width: 20 },
            { header: "Customer", key: "customer", width: 30 },
            { header: "Date", key: "date", width: 15 },
            { header: "Grand Total", key: "total", width: 15 },
            { header: "Status", key: "status", width: 15 }
        ];

        invoices.forEach(inv => {
            sheet.addRow({
                invoiceNumber: inv.invoiceNumber,
                customer: inv.customerId ? `${inv.customerId.firstName} ${inv.customerId.lastName}` : "Walk-in",
                date: inv.invoiceDate.toISOString().split('T')[0],
                total: inv.grandTotal,
                status: inv.paymentStatus
            });
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=invoices.xlsx");
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// Single Invoice Report (PDF Download)
export const exportSingleInvoicePdf = async (req, res) => {
    try {
        const inv = await Invoice.findById(req.params.id).populate("customerId");
        if (!inv) return res.status(404).json({ status: false, message: "Invoice not found" });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${inv.invoiceNumber}.pdf`);
        doc.pipe(res);

        doc.fontSize(25).text(`INVOICE: ${inv.invoiceNumber}`, { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Date: ${inv.invoiceDate.toISOString().split('T')[0]}`);
        doc.text(`Due Date: ${inv.dueDate.toISOString().split('T')[0]}`);
        doc.moveDown();
        doc.text("Bill To:");
        doc.text(inv.customerId ? `${inv.customerId.firstName} ${inv.customerId.lastName}` : "Walk-in Customer");
        if (inv.customerId?.email) doc.text(inv.customerId.email);
        doc.moveDown();

        doc.font("Helvetica-Bold").text("Items", { underline: true });
        inv.items.forEach((item, idx) => {
            doc.font("Helvetica").text(`${idx + 1}. ${item.productName} - Qty: ${item.quantity} x Rate: ${item.rate} = ${item.amount}`);
        });

        doc.moveDown();
        doc.font("Helvetica-Bold").text(`Subtotal: ${inv.subtotal}`);
        doc.text(`Tax: ${inv.taxAmount}`);
        doc.text(`Grand Total: ${inv.grandTotal}`);

        doc.end();
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};
