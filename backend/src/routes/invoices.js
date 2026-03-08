/**
 * SpaceV - Invoice Routes
 * ======================
 * Handles invoice management and PDF generation.
 * 
 * Endpoints:
 * - GET /api/invoices - List user's invoices
 * - GET /api/invoices/:id - Get single invoice
 * - GET /api/invoices/:id/pdf - Download PDF invoice
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { generateInvoicePDF } = require('../utils/invoice');
const { sendInvoiceEmail } = require('../utils/email');

// ==============================================
// GET /api/invoices - List user invoices
// ==============================================
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const where = {
    userId: req.user.id,
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    invoices,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ==============================================
// GET /api/invoices/:id - Get single invoice
// ==============================================
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: parseInt(id),
      userId: req.user.id,
    },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json({ invoice });
}));

// ==============================================
// GET /api/invoices/:id/pdf - Download PDF
// ==============================================
router.get('/:id/pdf', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: parseInt(id),
      userId: req.user.id,
    },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Check if PDF already exists
  if (invoice.pdfPath) {
    const pdfPath = path.join(__dirname, '../../../public', invoice.pdfPath);
    return res.download(pdfPath, `invoice-${invoice.invoiceNumber}.pdf`);
  }

  // Generate PDF
  const pdfPath = await generateInvoicePDF(invoice.id);

  // Update invoice with PDF path
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfPath },
  });

  // Send PDF
  const fullPdfPath = path.join(__dirname, '../../../public', pdfPath);
  res.download(fullPdfPath, `invoice-${invoice.invoiceNumber}.pdf`);
}));

// ==============================================
// POST /api/invoices/:id/resend - Resend invoice email
// ==============================================
router.post('/:id/resend', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: parseInt(id),
      userId: req.user.id,
    },
    include: {
      order: true,
      user: true,
    },
  });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (!invoice.user?.email) {
    return res.status(400).json({ error: 'No email address on file' });
  }

  // Send invoice email
  await sendInvoiceEmail(invoice.user, invoice, invoice.order);

  // Update sentAt
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { sentAt: new Date() },
  });

  res.json({ message: 'Invoice email resent' });
}));

module.exports = router;

