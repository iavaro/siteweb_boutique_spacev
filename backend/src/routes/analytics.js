/**
 * SpaceV - Analytics Routes
 * ========================
 * Handles analytics tracking and reporting.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { optionalAuth } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');

// ==============================================
// GET /api/analytics/track - Track page view
// ==============================================
router.post('/track', asyncHandler(async (req, res) => {
  const { type, data } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // Get or create today's analytics record
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let analytics = await prisma.analytics.findUnique({
    where: { date: today },
  });

  if (!analytics) {
    analytics = await prisma.analytics.create({
      data: { date: today },
    });
  }

  // Update based on event type
  switch (type) {
    case 'pageview':
      await prisma.analytics.update({
        where: { id: analytics.id },
        data: { pageViews: { increment: 1 } },
      });
      break;
    
    case 'visitor':
      await prisma.analytics.update({
        where: { id: analytics.id },
        data: { uniqueVisitors: { increment: 1 } },
      });
      break;
    
    case 'order':
      await prisma.analytics.update({
        where: { id: analytics.id },
        data: { 
          ordersCount: { increment: 1 },
          revenue: { increment: data.amount || 0 },
        },
      });
      break;
    
    case 'signup':
      await prisma.analytics.update({
        where: { id: analytics.id },
        data: { newUsers: { increment: 1 } },
      });
      break;
  }

  res.json({ success: true });
}));

// ==============================================
// GET /api/analytics/summary - Get analytics summary
// ==============================================
router.get('/summary', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  let startDate = new Date();
  switch (period) {
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
      startDate.setDate(startDate.getDate() - 30);
  }

  const analytics = await prisma.analytics.findMany({
    where: {
      date: { gte: startDate },
    },
    orderBy: { date: 'asc' },
  });

  // Aggregate data
  const summary = analytics.reduce((acc, day) => ({
    pageViews: acc.pageViews + day.pageViews,
    uniqueVisitors: acc.uniqueVisitors + day.uniqueVisitors,
    ordersCount: acc.ordersCount + day.ordersCount,
    revenue: acc.revenue + parseFloat(day.revenue || 0),
    newUsers: acc.newUsers + day.newUsers,
  }), {
    pageViews: 0,
    uniqueVisitors: 0,
    ordersCount: 0,
    revenue: 0,
    newUsers: 0,
  });

  // Calculate averages
  const days = analytics.length || 1;
  summary.averageDailyRevenue = summary.revenue / days;
  summary.averageDailyOrders = summary.ordersCount / days;

  res.json({
    period,
    summary,
    daily: analytics,
  });
}));

module.exports = router;

