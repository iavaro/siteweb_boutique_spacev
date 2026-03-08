/**
 * SpaceV - Webhook Routes
 * ======================
 * Handles Tebex and other webhooks.
 * 
 * Endpoints:
 * - POST /api/webhooks/tebex - Tebex payment webhook
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../prismaClient');
const { asyncHandler } = require('../middlewares/errorHandler');
const { generateInvoiceNumber } = require('../utils/helpers');
const { generateInvoicePDF } = require('../utils/invoice');
const { sendPurchaseConfirmation, sendInvoiceEmail } = require('../utils/email');
const { notifyNewPurchase } = require('../services/discordBot');

// ==============================================
// POST /api/webhooks/tebex - Tebex payment webhook
// ==============================================
router.post('/tebex', asyncHandler(async (req, res) => {
  const signature = req.headers['x-tebex-signature'];
  
  // Verify webhook signature if secret is configured
  if (process.env.TEBEX_WEBHOOK_SECRET && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.TEBEX_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      console.warn('Invalid Tebex webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const event = req.body;
  const eventType = event.event;
  
  console.log('Tebex webhook received:', eventType);

  // Log webhook for debugging
  await prisma.webhookLog.create({
    data: {
      provider: 'tebex',
      eventType: eventType,
      payload: event,
      processed: false,
    },
  });

  try {
    switch (eventType) {
      case 'payment':
      case 'payment_completed':
        await handlePayment(event);
        break;
      
      case 'payment_refund':
      case 'refund':
        await handleRefund(event);
        break;
      
      case 'payment_failed':
        await handlePaymentFailed(event);
        break;
      
      case 'player_join':
        await handlePlayerJoin(event);
        break;
      
      default:
        console.log('Unhandled Tebex event type:', eventType);
    }

    // Mark webhook as processed
    await prisma.webhookLog.updateMany({
      where: {
        provider: 'tebex',
        eventType: eventType,
        processed: false,
      },
      data: { processed: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Tebex webhook error:', error);
    
    // Log error
    await prisma.webhookLog.create({
      data: {
        provider: 'tebex',
        eventType: eventType,
        payload: event,
        processed: false,
        error: error.message,
      },
    });

    res.status(500).json({ error: 'Webhook processing failed' });
  }
}));

// ==============================================
// Handle payment completed
// ==============================================
async function handlePayment(event) {
  const { payment, customer, player, packages, transaction_id } = event;
  
  // Skip if already processed
  const existingOrder = await prisma.order.findFirst({
    where: { TebexTransactionId: String(transaction_id) },
  });

  if (existingOrder) {
    console.log('Order already exists for transaction:', transaction_id);
    return;
  }

  // Find user by email or username
  let userId = null;
  if (player?.uuid || player?.username) {
    // Try to find user by various identifiers
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: customer?.email },
          { username: player.username },
          { discordId: player.uuid },
        ],
      },
    });
    if (user) userId = user.id;
  }

  // Generate order ID
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Calculate total from packages
  let total = 0;
  const orderItems = [];

  for (const pkg of packages || []) {
    const price = parseFloat(pkg.price || 0);
    const quantity = parseInt(pkg.quantity || 1);
    total += price * quantity;

    // Find or create product
    let product = null;
    if (pkg.package_id) {
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { TebexPackageId: pkg.package_id },
            { id: parseInt(pkg.package_id) },
          ],
        },
      });
    }

    orderItems.push({
      productId: product?.id || null,
      quantity,
      price,
      total: price * quantity,
    });
  }

  // Create order
  const order = await prisma.order.create({
    data: {
      orderId,
      userId,
      guestEmail: customer?.email || null,
      status: 'COMPLETED',
      total,
      currency: payment?.currency || 'USD',
      TebexTransactionId: String(transaction_id),
      customerName: customer?.name || player?.username || 'Guest',
      customerEmail: customer?.email || null,
      customerIp: payment?.ip || null,
      items: {
        create: orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
    include: {
      items: { include: { product: true } },
      user: true,
    },
  });

  // Create invoice
  const invoiceNumber = generateInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId: order.id,
      userId,
      status: 'PAID',
      subtotal: total,
      tax: 0,
      total,
      currency: payment?.currency || 'USD',
    },
  });

  // Generate PDF invoice
  try {
    const pdfPath = await generateInvoicePDF(invoice.id);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfPath, sentAt: new Date() },
    });
  } catch (err) {
    console.warn('Failed to generate PDF invoice:', err.message);
  }

  // Send confirmation email
  if (order.user?.email) {
    sendPurchaseConfirmation(order.user, order, order.items.map(item => ({
      productName: item.product?.name || 'Unknown Product',
      quantity: item.quantity,
      price: item.price,
    }))).catch(err => console.warn('Failed to send confirmation email:', err.message));

    sendInvoiceEmail(order.user, invoice, order).catch(err => console.warn('Failed to send invoice email:', err.message));
  }

  // Send Discord notification
  notifyNewPurchase(order).catch(err => console.warn('Failed to send Discord notification:', err.message));

  // Create notification for user
  if (userId) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'ORDER',
        title: 'Purchase Complete!',
        message: `Your order #${orderId} has been processed successfully!`,
        link: '/dashboard/orders',
      },
    });
  }

  console.log('Order created:', orderId);
}

// ==============================================
// Handle refund
// ==============================================
async function handleRefund(event) {
  const { transaction_id } = event;
  
  const order = await prisma.order.findFirst({
    where: { TebexTransactionId: String(transaction_id) },
  });

  if (order) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
    });

    // Update invoice
    await prisma.invoice.update({
      where: { orderId: order.id },
      data: { status: 'VOID' },
    });

    // Notify user
    if (order.userId) {
      await prisma.notification.create({
        data: {
          userId: order.userId,
          type: 'ORDER',
          title: 'Order Refunded',
          message: `Your order #${order.orderId} has been refunded.`,
          link: '/dashboard/orders',
        },
      });
    }

    console.log('Order refunded:', order.orderId);
  }
}

// ==============================================
// Handle payment failed
// ==============================================
async function handlePaymentFailed(event) {
  const { transaction_id, customer, player } = event;
  
  console.log('Payment failed for transaction:', transaction_id);

  // Could create a pending order or notify admin
  if (customer?.email || player?.username) {
    // Log for admin review
    console.log('Failed payment attempt:', { customer, player });
  }
}

// ==============================================
// Handle player join (for delivery tracking)
// ==============================================
async function handlePlayerJoin(event) {
  const { player, packages } = event;
  
  console.log('Player joined:', player?.username);
  
  // Could track package delivery here
}

// ==============================================
// POST /api/webhooks/discord - Discord webhook
// ==============================================
router.post('/discord', asyncHandler(async (req, res) => {
  // Handle Discord webhook events if needed
  res.json({ success: true });
}));

module.exports = router;

