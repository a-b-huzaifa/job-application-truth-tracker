import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import userRepository from '../repositories/userRepository.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: (parseResult.error.issues || parseResult.error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { email, password } = parseResult.data;

    const existingUser = await userRepository.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already in use',
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await userRepository.createUser(email.toLowerCase(), passwordHash);
    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        created_at: newUser.created_at,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Internal server error during registration',
    });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: (parseResult.error.issues || parseResult.error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { email, password } = parseResult.data;

    const user = await userRepository.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error during login',
    });
  }
});

// GET /auth/me (Protected)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await userRepository.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching user profile',
    });
  }
});

export default router;
