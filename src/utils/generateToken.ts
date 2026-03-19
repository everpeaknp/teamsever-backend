const jwt = require("jsonwebtoken");

interface TokenPayload {
  id: string;
  email: string;
  name: string;
}

const generateToken = (id: string, email: string, name: string): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  
  const payload: TokenPayload = { id, email, name };
  
  return jwt.sign(payload, secret, {
    expiresIn: "7d"
  });
};

module.exports = generateToken;

export {};
