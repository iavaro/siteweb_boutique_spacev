/**
 * SpaceV - PDF Invoice Generator
 * ==============================
 * Generates PDF invoices using PDFKit.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');

/**
 * Generate PDF invoice
 * @param {number} invoiceId - Invoice ID
 * @returns {Promise<string>} Path to generated PDF
 */
const generateInvoicePDF = async (invoiceId) => {
  // Get invoice with order details
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
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
      user: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Create uploads directory if not exists
  const invoicesDir = path.join(__dirname, '../../../public/invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  // Generate filename
  const filename = `${invoice.invoiceNumber}.pdf`;
  const filePath = path.join(invoicesDir, filename);

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  // Create write stream
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ==============================================
  // PDF Content
  // ==============================================

  // Header background
  doc.rect(0, 0, doc.page.width, 120).fill('#0a0a0f');

  // Logo
  doc.fillColor('#8b5cf6')
    .fontSize(32)
    .font('Helvetica-Bold')
    .text('SpaceV', 50, 40);

  // Invoice title
  doc.fillColor('#ffffff')
    .fontSize(24)
    .font('Helvetica')
    .text('INVOICE', doc.page.width - 150, 40);

  // Invoice number
  doc.fillColor('#8b5cf6')
    .fontSize(12)
    .text(invoice.invoiceNumber, doc.page.width - 150, 70);

  // Reset for body
  doc.fillColor('#000000');

  // Company Info
  doc.fontSize(10)
    .fillColor('#666666')
    .text('SpaceV', 50, 140)
    .text('support@spacev.store', 50, 155)
    .text('https://spacev.store', 50, 170);

  // Invoice Details (right side)
  doc.fillColor('#333333')
    .fontSize(10)
    .text(`Invoice Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 400, 140)
    .text(`Status: ${invoice.status}`, 400, 155)
    .text(`Order ID: ${invoice.order.orderId}`, 400, 170);

  // Bill To
  doc.fillColor('#000000')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Bill To:', 50, 220);

  const customerName = invoice.user?.username || invoice.order.customerName || 'Guest';
  const customerEmail = invoice.user?.email || invoice.order.customerEmail || 'N/A';

  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('#333333')
    .text(customerName, 50, 240)
    .text(customerEmail, 50, 255);

  // Table Header
  const tableTop = 310;
  const col1 = 50;
  const col2 = 250;
  const col3 = 350;
  const col4 = 450;

  doc.rect(50, tableTop - 10, doc.page.width - 100, 25).fill('#8b5cf6');

  doc.fillColor('#ffffff')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Item', col1 + 10, tableTop - 2)
    .text('Quantity', col2 + 10, tableTop - 2)
    .text('Price', col3 + 10, tableTop - 2)
    .text('Total', col4 + 10, tableTop - 2);

  // Table Rows
  let y = tableTop + 30;
  doc.font('Helvetica').fontSize(10).fillColor('#333333');

  for (const item of invoice.order.items) {
    const itemName = item.product?.name || 'Unknown Product';
    const itemPrice = parseFloat(item.price);
    const itemTotal = itemPrice * item.quantity;

    doc.text(itemName, col1 + 10, y)
      .text(item.quantity.toString(), col2 + 10, y, { width: 80, align: 'center' })
      .text(`$${itemPrice.toFixed(2)}`, col3 + 10, y, { width: 80, align: 'right' })
      .text(`$${itemTotal.toFixed(2)}`, col4 + 10, y, { width: 80, align: 'right' });

    y += 25;
  }

  // Divider line
  doc.strokeColor('#cccccc')
    .lineWidth(1)
    .moveTo(50, y + 10)
    .lineTo(doc.page.width - 50, y + 10)
    .stroke();

  // Totals
  y += 30;
  const subtotal = parseFloat(invoice.subtotal);
  const tax = parseFloat(invoice.tax);
  const total = parseFloat(invoice.total);

  doc.text('Subtotal:', col3, y, { width: 80, align: 'right' })
    .text(`$${subtotal.toFixed(2)}`, col4, y, { width: 80, align: 'right' });

  y += 20;
  doc.text('Tax:', col3, y, { width: 80, align: 'right' })
    .text(`$${tax.toFixed(2)}`, col4, y, { width: 80, align: 'right' });

  // Total box
  y += 25;
  doc.rect(col3 - 10, y - 5, 180, 30).fill('#8b5cf6');
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Total:', col3, y + 3, { width: 80, align: 'right' })
    .text(`$${total.toFixed(2)}`, col4, y + 3, { width: 80, align: 'right' });

  // Footer
  const footerY = doc.page.height - 80;
  doc.fillColor('#666666').fontSize(8);
  doc.text('Thank you for your business!', 50, footerY);
  doc.text('For questions, contact support@spacev.store', 50, footerY + 15);
  doc.text(`© ${new Date().getFullYear()} SpaceV. All rights reserved.`, 50, footerY + 30);

  // Finalize PDF
  doc.end();

  // Wait for stream to finish
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/invoices/${filename}`;
};

/**
 * Get invoice as buffer (for email attachment)
 * @param {number} invoiceId - Invoice ID
 * @returns {Promise<Buffer>} PDF buffer
 */
const getInvoiceBuffer = async (invoiceId) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
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
      user: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Build PDF content (simplified version)
    doc.rect(0, 0, doc.page.width, 80).fill('#8b5cf6');
    doc.fillColor('#ffffff')
      .fontSize(24)
      .text('INVOICE', 50, 30);
    
    doc.fillColor('#333333')
      .fontSize(12)
      .text(invoice.invoiceNumber, 50, 100)
      .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 50, 120);

    doc.fontSize(10)
      .text(`Customer: ${invoice.user?.username || 'Guest'}`, 50, 160)
      .text(`Email: ${invoice.user?.email || invoice.order.customerEmail || 'N/A'}`, 50, 180);

    doc.text(`Total: $${invoice.total}`, 50, 220);

    doc.end();
  });
};

module.exports = {
  generateInvoicePDF,
  getInvoiceBuffer,
};

