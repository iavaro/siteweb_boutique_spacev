/**
 * SpaceV - Error Handling Middleware
 * ==================================
 * Centralized error handling for API routes and frontend pages.
 * 
 * @exports errorHandler, notFoundHandler
 */

// ==============================================
// Not Found Handler (404)
// ==============================================
const notFoundHandler = (req, res, next) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next();
  }

  // Log 404 for debugging
  console.warn(`404 - Not Found: ${req.method} ${req.originalUrl}`);

  // If it's an API request, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Endpoint not found',
      path: req.path,
      method: req.method,
    });
  }

  // Otherwise redirect to home (for SPA-like behavior)
  res.redirect('/');
};

// ==============================================
// Global Error Handler
// ==============================================
const errorHandler = (err, req, res, next) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Log error details
  console.error('='.repeat(50));
  console.error('ERROR:', err.message);
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Stack:', err.stack);
  console.error('='.repeat(50));

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 'P2002') {
    // Prisma unique constraint violation
    statusCode = 409;
    message = 'Resource already exists';
  } else if (err.code === 'P2025') {
    // Prisma record not found
    statusCode = 404;
    message = 'Record not found';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // If it's an API request, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // For frontend pages, render error page or redirect
  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Error ${statusCode} - SpaceV</title>
      <style>
        body {
          background: #0a0a0f;
          color: #fff;
          font-family: 'Segoe UI', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
        }
        .error-container {
          text-align: center;
          padding: 40px;
        }
        h1 {
          font-size: 72px;
          color: #8b5cf6;
          margin: 0;
        }
        p {
          color: #9ca3af;
          font-size: 18px;
        }
        a {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          transition: transform 0.2s;
        }
        a:hover {
          transform: scale(1.05);
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>${statusCode}</h1>
        <p>${message}</p>
        <a href="/">Return Home</a>
      </div>
    </body>
    </html>
  `);
};

// ==============================================
// Async Handler Wrapper
// ==============================================
/**
 * Wrapper for async route handlers to catch errors automatically
 * @param {Function} fn - Async route handler function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==============================================
// Custom Error Classes
// ==============================================

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
};

