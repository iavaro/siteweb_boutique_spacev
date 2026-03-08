/**
 * SpaceV - Email Utility
 * ======================
 * Handles sending emails via SMTP using Nodemailer.
 * Used for registration, password reset, invoices, etc.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const nodemailer = require('nodemailer');

// ==============================================
// Create Transporter
// ==============================================

// Create reusable transporter object
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify transporter connection (for debugging)
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email transporter is ready');
    return true;
  } catch (error) {
    console.warn('⚠️ Email transporter not configured:', error.message);
    return false;
  }
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 * @param {string} options.from - Sender email (optional)
 * @returns {Promise} Send result
 */
const sendEmail = async ({ to, subject, text, html, from }) => {
  // Skip if email not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email not configured, skipping send to:', to);
    return { skipped: true };
  }

  const mailOptions = {
    from: from || process.env.EMAIL_FROM || `SpaceV <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: text || html?.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

// ==============================================
// Email Templates
// ==============================================

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = async (user) => {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to SpaceV! 🎮',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0a0a0f; color: #fff; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 16px; padding: 40px; }
          .logo { text-align: center; font-size: 32px; font-weight: bold; color: #8b5cf6; margin-bottom: 20px; }
          .title { font-size: 24px; color: #fff; margin-bottom: 20px; }
          .content { color: #9ca3af; line-height: 1.6; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2a2a3a; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🚀 SpaceV</div>
          <div class="title">Welcome, ${user.username}!</div>
          <div class="content">
            <p>Thank you for joining SpaceV! We're excited to have you on board.</p>
            <p>With your SpaceV account, you can:</p>
            <ul>
              <li>Purchase VIP ranks and exclusive items</li>
              <li>Track your order history</li>
              <li>Access exclusive perks and rewards</li>
              <li>Connect with our community</li>
            </ul>
            <center>
              <a href="${process.env.SITE_URL}/store" class="button">Browse Store</a>
            </center>
          </div>
          <div class="footer">
            <p>If you have any questions, feel free to reply to this email or join our Discord server.</p>
            <p>© ${new Date().getFullYear()} SpaceV. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

/**
 * Send purchase confirmation email
 */
const sendPurchaseConfirmation = async (user, order, items) => {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a;">${item.productName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: right;">$${item.price}</td>
    </tr>
  `).join('');

  return sendEmail({
    to: user.email,
    subject: `Order Confirmed - #${order.orderId} | SpaceV`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0a0a0f; color: #fff; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 16px; padding: 40px; }
          .logo { text-align: center; font-size: 32px; font-weight: bold; color: #8b5cf6; margin-bottom: 20px; }
          .title { font-size: 24px; color: #fff; margin-bottom: 10px; }
          .order-id { color: #8b5cf6; font-size: 14px; margin-bottom: 20px; }
          .content { color: #9ca3af; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 12px; border-bottom: 2px solid #8b5cf6; color: #8b5cf6; }
          .total { font-size: 20px; font-weight: bold; color: #8b5cf6; text-align: right; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2a2a3a; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🚀 SpaceV</div>
          <div class="title">Thank you for your purchase!</div>
          <div class="order-id">Order #${order.orderId}</div>
          <div class="content">
            <p>Hi ${user.username},</p>
            <p>Your order has been confirmed and is being processed. Here's a summary:</p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div class="total">Total: $${order.total}</div>
            <p>You'll receive another email once your order is delivered in-game.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} SpaceV. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

/**
 * Send invoice email
 */
const sendInvoiceEmail = async (user, invoice, order) => {
  return sendEmail({
    to: user.email,
    subject: `Invoice ${invoice.invoiceNumber} | SpaceV`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0a0a0f; color: #fff; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 16px; padding: 40px; }
          .logo { text-align: center; font-size: 32px; font-weight: bold; color: #8b5cf6; margin-bottom: 20px; }
          .invoice-number { color: #8b5cf6; font-size: 14px; margin-bottom: 20px; }
          .content { color: #9ca3af; line-height: 1.6; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2a2a3a; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🚀 SpaceV</div>
          <div class="invoice-number">Invoice #${invoice.invoiceNumber}</div>
          <div class="content">
            <p>Hi ${user.username},</p>
            <p>Your invoice is attached to this email.</p>
            <p><strong>Amount:</strong> $${invoice.total}<br>
            <strong>Status:</strong> ${invoice.status}<br>
            <strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
            <center>
              <a href="${process.env.SITE_URL}/invoices/${invoice.id}" class="button">View Invoice</a>
            </center>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} SpaceV. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, resetToken) => {
  return sendEmail({
    to: user.email,
    subject: 'Reset your SpaceV password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0a0a0f; color: #fff; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 16px; padding: 40px; }
          .logo { text-align: center; font-size: 32px; font-weight: bold; color: #8b5cf6; margin-bottom: 20px; }
          .content { color: #9ca3af; line-height: 1.6; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2a2a3a; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🚀 SpaceV</div>
          <div class="content">
            <p>Hi ${user.username},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <center>
              <a href="${process.env.SITE_URL}/reset-password?token=${resetToken}" class="button">Reset Password</a>
            </center>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} SpaceV. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

// ==============================================
// Exports
// ==============================================

module.exports = {
  transporter,
  verifyTransporter,
  sendEmail,
  sendWelcomeEmail,
  sendPurchaseConfirmation,
  sendInvoiceEmail,
  sendPasswordResetEmail,
};

