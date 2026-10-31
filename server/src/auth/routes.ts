/**
 * Authentication HTTP routes.
 * Foundation: register + login with JWT.
 * Full session / refresh token flow can be added later.
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/client.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(24).optional(),
  email: z.string().email().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function signToken(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { username: body.username.toLowerCase() },
    });
    if (existing) {
      throw new AppError(409, 'Username already taken', 'USERNAME_TAKEN');
    }

    const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
    const displayName = body.displayName ?? body.username;

    const user = await prisma.user.create({
      data: {
        username: body.username.toLowerCase(),
        passwordHash,
        displayName,
        email: body.email,
        profile: {
          create: {},
        },
      },
      include: { profile: true },
    });

    const accessToken = signToken(user.id, user.username);

    logger.info('User registered', { userId: user.id, username: user.username });

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      expiresIn: env.JWT_EXPIRES_IN,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, 'Validation failed', 'VALIDATION_ERROR', err.flatten()));
    }
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username: body.username.toLowerCase() },
    });
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const accessToken = signToken(user.id, user.username);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      expiresIn: env.JWT_EXPIRES_IN,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, 'Validation failed', 'VALIDATION_ERROR', err.flatten()));
    }
    next(err);
  }
});
