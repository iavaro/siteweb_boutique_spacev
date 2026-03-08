/**
 * SpaceV - Admin Routes
 * ====================
 * Handles admin dashboard, user management, and analytics.
 * 
 * Endpoints:
 * - GET /api/admin/dashboard - Dashboard statistics
 * - GET /api/admin/users - User management
 * - PUT /api/admin/users/:id - Update user
 * - DELETE /api/admin/users/:id - Delete user
 * - GET /api/admin/orders - Order management
 * - PUT /api/admin/orders/:id - Update order
 * - GET /api/admin/products - Product management
 * - GET /api/admin/analytics - Analytics data
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken, requireAdmin, requireModerator } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');

// Apply requireModerator to all routes
router.use(requireModerator);

// ==============================================
// GET /api/admin/dashboard - Dashboard stats
// ==============================================
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get various stats
  const [
    totalUsers,
    totalOrders,
    totalRevenue,
    pendingOrders,
    recentOrders,
    topProducts,
    recentSignups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.findMany({
      include: {
        user: { select: { username: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  // Get product details for top products
  const topProductsWithDetails = await Promise.all(
    topProducts.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      return {
        product,
        totalQuantity: item._sum.quantity,
      };
    })
  );

  res.json({
    stats: {
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingOrders,
    },
    recentOrders,
    topProducts: topProductsWithDetails,
    recentSignups,
  });
}));

// ==============================================
// GET /api/admin/users - List users
// ==============================================
router.get('/users', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;

  const where = {};

  // Search by username or email
  if (search) {
    where.OR = [
      { username: { contains: search } },
      { email: { contains: search } },
    ];
  }

  // Filter by role
  if (role) {
    where.role = role.toUpperCase();
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        discordId: true,
        discordUsername: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ==============================================
// GET /api/admin/users/:id - Get single user
// ==============================================
router.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) },
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
        select: { orders: true, invoices: true, notifications: true },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get recent orders
  const recentOrders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({ user, recentOrders });
}));

// ==============================================
// PUT /api/admin/users/:id - Update user
// ==============================================
router.put('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, role, emailVerified } = req.body;

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent modifying own admin role
  if (parseInt(id) === req.user.id && role && role !== 'ADMIN' && role !== 'OWNER') {
    return res.status(400).json({ error: 'Cannot change your own admin role' });
  }

  const user = await prisma.user.update({
    where: { id: parseInt(id) },
    data: {
      ...(username && { username }),
      ...(role && { role: role.toUpperCase() }),
      ...(emailVerified !== undefined && { emailVerified }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      emailVerified: true,
    },
  });

  res.json({ message: 'User updated', user });
}));

// ==============================================
// DELETE /api/admin/users/:id - Delete user
// ==============================================
router.delete('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent deleting self
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Soft delete - just deactivate
  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { email: `deleted_${user.id}_${user.email}` },
  });

  res.json({ message: 'User deleted' });
}));

// ==============================================
// GET /api/admin/orders - List orders
// ==============================================
router.get('/orders', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const where = {};

  if (status) {
    where.status = status.toUpperCase();
  }

  // Search by order ID or customer email
  if (search) {
    where.OR = [
      { orderId: { contains: search } },
      { customerEmail: { contains: search } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { username: true, email: true } },
        items: { include: { product: true } },
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

// ==============================================
// GET /api/admin/orders/:id - Get single order
// ==============================================
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id: parseInt(id) },
    include: {
      user: { select: { id: true, username: true, email: true } },
      items: { include: { product: true } },
      invoice: true,
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json({ order });
}));

// ==============================================
// PUT /api/admin/orders/:id - Update order
// ==============================================
router.put('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const order = await prisma.order.findUnique({ where: { id: parseInt(id) } });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const updatedOrder = await prisma.order.update({
    where: { id: parseInt(id) },
    data: {
      ...(status && { status: status.toUpperCase() }),
    },
    include: {
      user: { select: { username: true, email: true } },
      items: { include: { product: true } },
    },
  });

  // Create notification for user if status changed
  if (status && order.userId) {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER',
        title: 'Order Status Updated',
        message: `Your order #${order.orderId} status has been updated to ${status}`,
        link: `/dashboard/orders/${order.id}`,
      },
    });
  }

  res.json({ message: 'Order updated', order: updatedOrder });
}));

// ==============================================
// GET /api/admin/products - Product management
// ==============================================
router.get('/products', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, category, type, isActive } = req.query;

  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (category) {
    const cat = await prisma.category.findUnique({ where: { slug: category } });
    if (cat) where.categoryId = cat.id;
  }

  if (type) {
    where.type = type.toUpperCase();
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ==============================================
// GET /api/admin/analytics - Analytics data
// ==============================================
router.get('/analytics', asyncHandler(async (req, res) => {
  const { period = '7d' } = req.query;

  let startDate = new Date();
  switch (period) {
    case '24h':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const [
    totalRevenue,
    totalOrders,
    averageOrderValue,
    ordersByDay,
    ordersByStatus,
    topProducts,
    newUsersCount,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      _sum: { total: true },
      _avg: { total: true },
      _count: true,
    }),
    prisma.order.count({
      where: { createdAt: { gte: startDate } },
    }),
    prisma.order.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      _avg: { total: true },
    }),
    prisma.$queryRaw`
      SELECT DATE(createdAt) as date, COUNT(*) as count, SUM(total) as revenue
      FROM orders
      WHERE status = 'COMPLETED' AND createdAt >= ${startDate}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `,
    prisma.order.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: startDate } },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      _count: true,
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
    prisma.user.count({
      where: { createdAt: { gte: startDate } },
    }),
  ]);

  res.json({
    period,
    summary: {
      revenue: totalRevenue._sum.total || 0,
      orders: totalOrders,
      averageOrderValue: averageOrderValue._avg.total || 0,
      newUsers: newUsersCount,
    },
    ordersByDay,
    ordersByStatus,
    topProducts,
  });
}));

// ==============================================
// GET /api/admin/settings - Site settings
// ==============================================
router.get('/settings', requireAdmin, asyncHandler(async (req, res) => {
  const settings = await prisma.siteSettings.findMany();
  
  const settingsMap = {};
  settings.forEach(s => {
    settingsMap[s.key] = s.value;
  });

  res.json({ settings: settingsMap });
}));

// ==============================================
// PUT /api/admin/settings - Update settings
// ==============================================
router.put('/settings', requireAdmin, asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object required' });
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSettings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  res.json({ message: 'Settings updated' });
}));

module.exports = router;

