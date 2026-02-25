import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

//Export customers to Excel

export const exportToExcel = async (customers) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers");

    // Define columns
    worksheet.columns = [
        { header: "S.No", key: "sno", width: 8 },
        { header: "Customer Code", key: "code", width: 15 },
        { header: "First Name", key: "firstName", width: 20 },
        { header: "Last Name", key: "lastName", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Address", key: "address", width: 30 },
        { header: "City", key: "city", width: 15 },
        { header: "State", key: "state", width: 15 },
        { header: "Country", key: "country", width: 15 },
        { header: "Postal Code", key: "postalCode", width: 12 },
        { header: "GSTIN", key: "gstin", width: 20 },
        { header: "Status", key: "status", width: 10 },
        { header: "Created At", key: "createdAt", width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" }
    };

    customers.forEach((customer, index) => {
        worksheet.addRow({
            sno: index + 1,
            code: customer.code,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone || "",
            address: customer.address || "",
            city: customer.city || "",
            state: customer.state || "",
            country: customer.country || "",
            postalCode: customer.postalCode || "",
            gstin: customer.gstin || "",
            status: customer.status,
            createdAt: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "-"
        });
    });

    worksheet.autoFilter = {
        from: "A1",
        to: "N1"
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

// Export customers to PDF
export const exportToPDF = (customers) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                layout: "landscape",
                margin: 50,
                bufferPages: true
            });

            const chunks = [];

            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            // Title
            doc.fontSize(20).font("Helvetica-Bold").text("Customer List", { align: "center" });
            doc.moveDown();

            // Date
            doc.fontSize(10).font("Helvetica").text(`Generated on: ${new Date().toLocaleDateString()}`, { align: "right" });
            doc.moveDown();

            // Table header
            const tableTop = 150;
            const itemHeight = 25;
            let currentY = tableTop;

            // Column positions
            const cols = {
                code: 50,
                name: 120,
                email: 250,
                phone: 380,
                city: 480,
                status: 580,
                country: 650
            };

            // Draw header
            doc.fontSize(10).font("Helvetica-Bold");
            doc.rect(40, currentY - 5, 760, 20).fillAndStroke("#4472C4", "#000");
            doc.fillColor("#FFF");
            doc.text("Code", cols.code, currentY);
            doc.text("Name", cols.name, currentY);
            doc.text("Email", cols.email, currentY);
            doc.text("Phone", cols.phone, currentY);
            doc.text("City", cols.city, currentY);
            doc.text("Status", cols.status, currentY);
            doc.text("Country", cols.country, currentY);

            currentY += itemHeight;
            doc.fillColor("#000").font("Helvetica");

            // Draw rows
            customers.forEach((customer, index) => {
                // Check if we need a new page
                if (currentY > 500) {
                    doc.addPage({ size: "A4", layout: "landscape", margin: 50 });
                    currentY = 50;
                }

                // Alternate row colors
                if (index % 2 === 0) {
                    doc.rect(40, currentY - 5, 760, 20).fillAndStroke("#F0F0F0", "#E0E0E0");
                } else {
                    doc.rect(40, currentY - 5, 760, 20).stroke("#E0E0E0");
                }

                doc.fillColor("#000");
                doc.fontSize(9);
                doc.text(customer.code || "", cols.code, currentY, { width: 60, ellipsis: true });
                doc.text(`${customer.firstName} ${customer.lastName}`, cols.name, currentY, { width: 120, ellipsis: true });
                doc.text(customer.email || "", cols.email, currentY, { width: 120, ellipsis: true });
                doc.text(customer.phone || "", cols.phone, currentY, { width: 90, ellipsis: true });
                doc.text(customer.city || "", cols.city, currentY, { width: 90, ellipsis: true });
                doc.text(customer.status || "", cols.status, currentY, { width: 60 });
                doc.text(customer.country || "", cols.country, currentY, { width: 100, ellipsis: true });

                currentY += itemHeight;
            });

            // Footer
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).text(
                    `Page ${i + 1} of ${pages.count}`,
                    50,
                    doc.page.height - 50,
                    { align: "center" }
                );
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

//Export single customer details to PDF
export const exportCustomerDetailsToPDF = (customer) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margin: 50,
                bufferPages: true
            });

            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            // Header - Business Name
            doc.fontSize(24).font("Helvetica-Bold").fillColor("#fe9f43").text("DreamsPOS ERP", { align: "center" });
            doc.fontSize(10).font("Helvetica").fillColor("#666").text("Customer Profile Report", { align: "center" });
            doc.moveDown(2);

            // Report Details Row
            doc.fontSize(10).font("Helvetica-Bold").fillColor("#333");
            doc.text(`Report Date: ${new Date().toLocaleDateString()}`, { align: "right" });
            doc.text(`Customer Code: ${customer.code}`, { align: "left" });
            doc.moveDown();

            // Divider
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#eee").stroke();
            doc.moveDown(2);

            // Main Info Section
            doc.fontSize(16).font("Helvetica-Bold").fillColor("#333").text("General Information");
            doc.moveDown();

            const leftCol = 100;
            const rightCol = 250;
            let currentY = doc.y;

            const drawDetailRow = (label, value) => {
                doc.fontSize(11).font("Helvetica-Bold").fillColor("#666").text(label, leftCol, currentY);
                doc.font("Helvetica").fillColor("#333").text(value || "N/A", rightCol, currentY);
                currentY += 25;
            };

            drawDetailRow("Full Name:", `${customer.firstName} ${customer.lastName || ""}`);
            drawDetailRow("Email Address:", customer.email);
            drawDetailRow("Phone Number:", customer.phone);
            drawDetailRow("Status:", customer.status);
            drawDetailRow("GST Number:", customer.gstin);

            doc.moveDown(2);
            currentY = doc.y;

            // Address Section
            doc.fontSize(16).font("Helvetica-Bold").fillColor("#333").text("Location Details");
            doc.moveDown();
            currentY = doc.y;

            drawDetailRow("Address:", customer.address);
            drawDetailRow("City:", customer.city);
            drawDetailRow("State:", customer.state);
            drawDetailRow("Country:", customer.country);
            drawDetailRow("Postal Code:", customer.postalCode);

            // Footer
            doc.fontSize(8).fillColor("#999").text(
                "Generated by DreamsPOS ERP System - Confidential Customer Information",
                50,
                doc.page.height - 50,
                { align: "center" }
            );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
