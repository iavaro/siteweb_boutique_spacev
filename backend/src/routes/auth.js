/**
 * SpaceV - Authentication Routes
 * ==============================
 * Handles user registration, login, logout, and Discord OAuth.
 * 
 * Endpoints:
 * - POST /api/auth/register - User registration
 * - POST /api/auth/login - User login
 * - POST /api/auth/logout - User logout
 * - GET /api/auth/me - Get current user
 * - GET /api/auth/discord - Discord OAuth redirect
 * - GET /api/auth/discord/callback - Discord OAuth callback
 * - POST /api/auth/forgot-password - Password reset request
 * - POST /api/auth/reset-password - Reset password with token
 * - POST /api/auth/verify-email - Verify email with token
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken, optionalAuth } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { generateToken } = require('../utils/helpers');

// ==============================================
// POST /api/auth/register
// ==============================================
router.post('/register', asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Validate input
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate username (alphanumeric and underscore, 3-20 chars)
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters, alphanumeric and underscores only' });
  }

  // Validate password (min 8 chars)
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate verification token
  const verificationToken = uuidv4();

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      verificationToken,
      role: 'USER',
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  // Send verification email (async, don't wait)
  sendEmail({
    to: email,
    subject: 'Verify your SpaceV account',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #8b5cf6;">Welcome to SpaceV!</h1>
        <p>Hi ${username},</p>
        <p>Thank you for registering. Please verify your email address:</p>
        <a href="${process.env.SITE_URL}/verify-email?token=${verificationToken}" 
           style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px;">
          Verify Email
        </a>
        <p style="margin-top: 20px; color: #666;">
          Or copy this link: ${process.env.SITE_URL}/verify-email?token=${verificationToken}
        </p>
      </div>
    `,
  }).catch(err => console.warn('Failed to send verification email:', err.message));

  // Generate JWT token
  const token = generateToken(user.id, user.role);

  // Set cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    message: 'Registration successful',
    user,
    token,
  });
}));

// ==============================================
// POST /api/auth/login
// ==============================================
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check if user has password (might be OAuth-only)
  if (!user.password) {
    return res.status(401).json({ 
      error: 'This account uses social login. Please sign in with Discord.' 
    });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  // Generate JWT token
  const token = generateToken(user.id, user.role);

  // Set cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Return user data (exclude sensitive fields)
  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      discordId: user.discordId,
      discordUsername: user.discordUsername,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    },
    token,
  });
}));

// ==============================================
// POST /api/auth/logout
// ==============================================
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// ==============================================
// GET /api/auth/me
// ==============================================
router.get('/me', optionalAuth, asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  // Get full user data including stats
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      discordId: true,
      discordUsername: true,
      avatar: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          invoices: true,
        },
      },
    },
  });

  res.json({ authenticated: true, user });
}));

// ==============================================
// GET /api/auth/discord
// ==============================================
router.get('/discord', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
    `client_id=${process.env.DISCORD_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=identify%20email&` +
    `state=${uuidv4()}`;

  res.redirect(discordAuthUrl);
});

// ==============================================
// GET /api/auth/discord/callback
// ==============================================
router.get('/discord/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/login?error=no_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info from Discord
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userResponse.data;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { discordId: discordUser.id },
    });

    if (!user) {
      // Check if user exists with same email
      if (discordUser.email) {
        const existingEmail = await prisma.user.findUnique({
          where: { email: discordUser.email.toLowerCase() },
        });

        if (existingEmail) {
          // Link Discord to existing account
          user = await prisma.user.update({
            where: { id: existingEmail.id },
            data: {
              discordId: discordUser.id,
              discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
              avatar: discordUser.avatar 
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
              emailVerified: true,
            },
          });
        } else {
          // Create new user with Discord
          user = await prisma.user.create({
            data: {
              email: discordUser.email.toLowerCase(),
              username: discordUser.username,
              discordId: discordUser.id,
              discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
              avatar: discordUser.avatar 
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
              emailVerified: true,
              role: 'USER',
            },
          });
        }
      } else {
        // Create new user without email (limited)
        user = await prisma.user.create({
          data: {
            username: discordUser.username,
            discordId: discordUser.id,
            discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
            avatar: discordUser.avatar 
              ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
              : null,
            emailVerified: false,
            role: 'USER',
          },
        });
      }
    } else {
      // Update existing user with latest Discord info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
          avatar: discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : user.avatar,
        },
      });
    }

    // Store or update linked account
    await prisma.linkedAccount.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'discord',
        },
      },
      create: {
        userId: user.id,
        provider: 'discord',
        providerId: discordUser.id,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect to dashboard or home
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Discord OAuth error:', error.response?.data || error.message);
    res.redirect('/login?error=discord_auth_failed');
  }
}));

// ==============================================
// POST /api/auth/forgot-password
// ==============================================
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If an account exists, a reset link has been sent' });
  }

  // Generate reset token
  const resetToken = uuidv4();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Save reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
    },
  });

  // Send reset email
  sendEmail({
    to: email,
    subject: 'Reset your SpaceV password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #8b5cf6;">Reset Password</h1>
        <p>Hi ${user.username},</p>
        <p>You requested a password reset. Click the button below:</p>
        <a href="${process.env.SITE_URL}/reset-password?token=${resetToken}" 
           style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px;">
          Reset Password
        </a>
        <p style="margin-top: 20px; color: #666;">
          This link expires in 1 hour.
        </p>
      </div>
    `,
  }).catch(err => console.warn('Failed to send reset email:', err.message));

  res.json({ message: 'If an account exists, a reset link has been sent' });
}));

// ==============================================
// POST /api/auth/reset-password
// ==============================================
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Find user with valid reset token
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Update password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  res.json({ message: 'Password reset successful' });
}));

// ==============================================
// POST /api/auth/verify-email
// ==============================================
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  // Find user with verification token
  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    return res.status(400).json({ error: 'Invalid verification token' });
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationToken: null,
    },
  });

  res.json({ message: 'Email verified successfully' });
}));

// ==============================================
// POST /api/auth/change-password
// ==============================================
router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user.password) {
    return res.status(400).json({ error: 'Cannot change password for OAuth accounts' });
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash and save new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  res.json({ message: 'Password changed successfully' });
}));

module.exports = router;

