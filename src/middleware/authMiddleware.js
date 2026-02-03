export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({
      message: "Not authorized",
      status: false,
      dataFound: false
    });
  }

  // later you can verify JWT here
  next();
};
