const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

const authMiddlewareFromQuery = (req, res, next) => {
  try {
    const token = req.query.token;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.userId !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

const generateAccessToken = (userId, clientId) => {
  const tokenPayload = {
    userId: userId,
  };

  const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  return accessToken;
};

const generateRefreshToken = () => {
  const refreshToken = uuidv4();

  return refreshToken;
};

module.exports = {
  authMiddleware,
  authMiddlewareFromQuery,
  adminAuthMiddleware,
  generateAccessToken,
  generateRefreshToken,
};
