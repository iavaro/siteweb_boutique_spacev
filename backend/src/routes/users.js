/**
 * SpaceV - User Routes
 * ===================
 * Handles user dashboard, profile, and notifications.
 * 
 * Endpoints:
 * - GET /api/users/me - Get current user profile
 * - PUT /api/users/me - Update profile
 * - GET /api/users/notifications - Get user notifications
 * - PUT /api/users/notifications/:id/read - Mark notification as read
 * - DELETE /api/users/notifications - Clear all notifications
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');

// ==============================================
// GET /api/users/me - Get current user profile
// ==============================================
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
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
      updatedAt: true,
      _count: {
        select: {
          orders: true,
          invoices: true,
        },
      },
    },
  });

  // Get recent orders
  const recentOrders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Get unread notifications count
  const unreadCount = await prisma.notification.count({
    where: {
      userId: req.user.id,
      isRead: false,
    },
  });

  res.json({
    user,
    recentOrders,
    unreadNotifications: unreadCount,
  });
}));

// ==============================================
// PUT /api/users/me - Update profile
// ==============================================
router.put('/me', authenticateToken, asyncHandler(async (req, res) => {
  const { username, avatar } = req.body;

  // Check if username is being changed
  if (username && username !== req.user.username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(username && { username }),
      ...(avatar !== undefined && { avatar }),
    },
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
    },
  });

  res.json({ message: 'Profile updated', user });
}));

// ==============================================
// PUT /api/users/me/password - Change password
// ==============================================
router.put('/me/password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user.password) {
    return res.status(400).json({ error: 'Cannot change password for OAuth accounts' });
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedPassword },
  });

  res.json({ message: 'Password changed successfully' });
}));

// ==============================================
// GET /api/users/notifications - Get notifications
// ==============================================
router.get('/notifications', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const where = {
    userId: req.user.id,
  };

  if (unreadOnly === 'true') {
    where.isRead = false;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    }),
  ]);

  res.json({
    notifications,
    unreadCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ==============================================
// PUT /api/users/notifications/:id/read - Mark as read
// ==============================================
router.put('/notifications/:id/read', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.notification.updateMany({
    where: {
      id: parseInt(id),
      userId: req.user.id,
    },
    data: { isRead: true },
  });

  res.json({ message: 'Notification marked as read' });
}));

// ==============================================
// PUT /api/users/notifications/read-all - Mark all as read
// ==============================================
router.put('/notifications/read-all', authenticateToken, asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  res.json({ message: 'All notifications marked as read' });
}));

// ==============================================
// DELETE /api/users/notifications/:id - Delete notification
// ==============================================
router.delete('/notifications/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.notification.deleteMany({
    where: {
      id: parseInt(id),
      userId: req.user.id,
    },
  });

  res.json({ message: 'Notification deleted' });
}));

// ==============================================
// DELETE /api/users/notifications - Clear all
// ==============================================
router.delete('/notifications', authenticateToken, asyncHandler(async (req, res) => {
  await prisma.notification.deleteMany({
    where: { userId: req.user.id },
  });

  res.json({ message: 'All notifications cleared' });
}));

// ==============================================
// GET /api/users/orders - User orders (alias)
// ==============================================
router.get('/orders', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const where = {
    userId: req.user.id,
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

module.exports = router;

