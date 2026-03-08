/**
 * SpaceV - Order Routes
 * ====================
 * Handles cart operations and order management.
 * 
 * Endpoints:
 * - GET /api/orders - Get user's orders
 * - GET /api/orders/:id - Get single order
 * - POST /api/orders/checkout - Create checkout session (Tebex)
 * - GET /api/orders/history - Get user's order history
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken, optionalAuth } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { generateInvoiceNumber } = require('../utils/helpers');
const { generateInvoicePDF } = require('../utils/invoice');
const { sendPurchaseConfirmation, sendInvoiceEmail } = require('../utils/email');
const { notifyNewPurchase } = require('../services/discordBot');

// In-memory cart storage (use Redis in production)
const carts = new Map();

/**
 * Get or create cart for user/guest
 */
const getCart = (userId, sessionId) => {
  const cartKey = userId || sessionId;
  if (!carts.has(cartKey)) {
    carts.set(cartKey, []);
  }
  return carts.get(cartKey);
};

/**
 * Save cart
 */
const saveCart = (userId, sessionId, items) => {
  const cartKey = userId || sessionId;
  carts.set(cartKey, items);
};

// ==============================================
// GET /api/orders/cart - Get cart contents
// ==============================================
router.get('/cart', optionalAuth, asyncHandler(async (req, res) => {
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
  const cart = getCart(req.user?.id, sessionId);
  
  // Get product details for cart items
  const productIds = cart.map(item => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
    },
  });

  // Map cart items with product data
  const cartItems = cart.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return null;
    return {
      id: item.productId,
      product,
      quantity: item.quantity,
      total: parseFloat(product.price) * item.quantity,
    };
  }).filter(Boolean);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);

  res.json({
    items: cartItems,
    subtotal,
    itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
  });
}));

// ==============================================
// POST /api/orders/cart - Add item to cart
// ==============================================
router.post('/cart', optionalAuth, asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'];

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  // Verify product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: parseInt(productId) },
  });

  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Get current cart
  const cart = getCart(req.user?.id, sessionId);

  // Check if item already in cart
  const existingIndex = cart.findIndex(item => item.productId === parseInt(productId));

  if (existingIndex >= 0) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({ productId: parseInt(productId), quantity });
  }

  // Save cart
  saveCart(req.user?.id, sessionId, cart);

  res.json({
    message: 'Item added to cart',
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
  });
}));

// ==============================================
// PUT /api/orders/cart/:productId - Update cart item
// ==============================================
router.put('/cart/:productId', optionalAuth, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'];

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  const cart = getCart(req.user?.id, sessionId);
  const index = cart.findIndex(item => item.productId === parseInt(productId));

  if (index < 0) {
    return res.status(404).json({ error: 'Item not found in cart' });
  }

  if (quantity === 0) {
    // Remove item
    cart.splice(index, 1);
  } else {
    cart[index].quantity = quantity;
  }

  saveCart(req.user?.id, sessionId, cart);

  res.json({
    message: 'Cart updated',
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
  });
}));

// ==============================================
// DELETE /api/orders/cart/:productId - Remove from cart
// ==============================================
router.delete('/cart/:productId', optionalAuth, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'];

  const cart = getCart(req.user?.id, sessionId);
  const index = cart.findIndex(item => item.productId === parseInt(productId));

  if (index >= 0) {
    cart.splice(index, 1);
    saveCart(req.user?.id, sessionId, cart);
  }

  res.json({
    message: 'Item removed from cart',
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
  });
}));

// ==============================================
// DELETE /api/orders/cart - Clear cart
// ==============================================
router.delete('/cart', optionalAuth, asyncHandler(async (req, res) => {
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
  saveCart(req.user?.id, sessionId, []);
  
  res.json({ message: 'Cart cleared', cartCount: 0 });
}));

// ==============================================
// POST /api/orders/checkout - Create Tebex checkout
// ==============================================
router.post('/checkout', optionalAuth, asyncHandler(async (req, res) => {
  const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
  const cart = getCart(req.user?.id, sessionId);

  if (cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Get product details
  const productIds = cart.map(item => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
    },
  });

  if (products.length === 0) {
    return res.status(400).json({ error: 'No valid products in cart' });
  }

  // Calculate total
  let total = 0;
  const orderItems = cart.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return null;
    const itemTotal = parseFloat(product.price) * item.quantity;
    total += itemTotal;
    return {
      productId: product.id,
      product,
      quantity: item.quantity,
      price: product.price,
      total: itemTotal,
    };
  }).filter(Boolean);

  // Generate Tebex checkout URL
  // In production, you would use Tebex API to create a checkout session
  // Here we construct a basic Tebex checkout URL
  const tebexStoreUrl = process.env.TEBEX_STORE_URL || 'https://your-store.tebex.io';
  
  // Build cart packages for Tebex
  const packages = orderItems.map(item => ({
    id: item.product.TebexPackageId || item.productId,
    quantity: item.quantity,
  }));

  // Create checkout URL with cart data
  const checkoutUrl = `${tebexStoreUrl}/checkout?cart=${encodeURIComponent(JSON.stringify(packages))}`;

  res.json({
    checkoutUrl,
    orderSummary: {
      items: orderItems,
      subtotal: total,
      total,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    },
  });
}));

// ==============================================
// GET /api/orders - Get user's orders
// ==============================================
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  // Valid OrderStatus enum values
  const validStatuses = ['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FRAUDULENT'];

  const where = {
    userId: req.user.id,
  };

  // Only apply status filter if it's a valid OrderStatus value
  if (status && validStatuses.includes(status.toUpperCase())) {
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
      orderBy: {
        createdAt: 'desc',
      },
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
// GET /api/orders/:id - Get single order
// ==============================================
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await prisma.order.findFirst({
    where: {
      id: parseInt(id),
      userId: req.user.id,
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      invoice: true,
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json({ order });
}));

// ==============================================
// GET /api/orders/history - Order history
// ==============================================
router.get('/history', authenticateToken, asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  res.json({ orders });
}));

// ==============================================
// POST /api/orders (internal - from Tebex webhook)
// ==============================================
router.post('/', asyncHandler(async (req, res) => {
  // This endpoint is called by Tebex webhook
  // See webhooks.js for implementation
  res.status(501).json({ error: 'Use /api/webhooks/tebex' });
}));

module.exports = router;

