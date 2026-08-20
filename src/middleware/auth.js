import jwt from 'jsonwebtoken';
import 'dotenv/config';

export function auth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized: Missing Authorization header',
    });
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Unauthorized: Malformed Authorization header. Expected Bearer <token>',
    });
  }

  const token = parts[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('JWT_SECRET is not defined in environment variables');
    return res.status(500).json({
      error: 'Internal server error: JWT secret misconfigured',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId || decoded.id || decoded.sub;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired token',
      details: err.message,
    });
  }
}

export default auth;
