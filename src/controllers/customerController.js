import Customer from "../models/Customer.js";

/* GET /api/customers (List + Search + Filter + Sort + Pagination) */
export const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const skip = (page - 1) * limit;

    // 🔍 Search + Filter
    const query = {};
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
        { code: new RegExp(search, "i") }
      ];
    }
    if (status) query.status = status;

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      message: "Data Retrieved Successfully",
      status: true,
      dataFound: customers.length > 0,
      data: customers.map(c => ({
        id: c._id,
        code: c.code,
        customer: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        state: c.state,
        country: c.country,
        postalCode: c.postalCode,
        status: c.status
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve customers",
      status: false,
      dataFound: false
    });
  }
};

/* POST /api/customers/add */
export const addCustomer = async (req, res) => {
  try {
    const count = await Customer.countDocuments();
    const code = `CU${String(count + 1).padStart(3, "0")}`;

    await Customer.create({ ...req.body, code });

    res.status(201).json({
      message: "Customer Created Successfully",
      status: true,
      dataFound: true
    });
  } catch (error) {
    console.error("Add customer error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Customer with this email already exists",
        status: false,
        dataFound: false
      });
    }

    res.status(500).json({
      message: error.message || "Failed to create customer",
      status: false,
      dataFound: false
    });
  }
};

/* GET /api/customers/:id */
export const getCustomerById = async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return res.status(404).json({
      message: "Customer Not Found",
      status: false,
      dataFound: false
    });
  }

  res.json({
    message: "Data Retrieved Successfully",
    status: true,
    dataFound: true,
    data: {
      id: customer._id,
      code: customer.code,
      customer: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      postalCode: customer.postalCode,
      status: customer.status
    }
  });
};

/* PUT /api/customers/:id */
export const updateCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, req.body);
    res.json({
      message: "Customer Details Updated Successfully",
      status: true,
      dataFound: true
    });
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({
      message: error.message || "Failed to update customer",
      status: false,
      dataFound: false
    });
  }
};

/* PATCH /api/customers/:id/status */
export const toggleCustomerStatus = async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );

  res.json({
    message: "Customer Status Updated Successfully",
    status: true,
    dataFound: true,
    data: { id: customer._id, status: customer.status }
  });
};

/* DELETE /api/customers/:id */
export const deleteCustomer = async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({
    message: "Customer Deleted Successfully",
    status: true,
    dataFound: true
  });
};

/* POST /api/customers/bulk-delete */
export const bulkDeleteCustomers = async (req, res) => {
  const result = await Customer.deleteMany({ _id: { $in: req.body.ids } });

  res.json({
    message: "Customers Deleted Successfully",
    status: true,
    dataFound: true,
    data: { deletedCount: result.deletedCount }
  });
};

/* POST /api/customers/bulk-update */
export const bulkUpdateCustomers = async (req, res) => {
  const result = await Customer.updateMany(
    { _id: { $in: req.body.ids } },
    { status: req.body.status }
  );

  res.json({
    message: "Customers Updated Successfully",
    status: true,
    dataFound: true,
    data: { updatedCount: result.modifiedCount }
  });
};

/* GET /api/customers/export */
export const exportCustomers = async (req, res) => {
  const format = req.query.format;

  if (format === "pdf") {
    return res.send("PDF file download");
  }
  if (format === "xlsx") {
    return res.send("Excel file download");
  }

  res.status(400).json({
    message: "Invalid export format",
    status: false
  });
};
