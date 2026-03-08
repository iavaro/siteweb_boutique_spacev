/**
 * SpaceV - Authentication Middleware
 * =================================
 * Handles JWT token verification and role-based access control.
 * 
 * @exports authenticateToken, requireRole, optionalAuth
 */

const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

/**
 * Verify JWT token from Authorization header or cookies
 * Attaches user to req.user if valid
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header or cookies
    let token = req.headers.authorization?.split(' ')[1] || req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        discordId: true,
        discordUsername: true,
        avatar: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Require specific role(s) - must be used after authenticateToken
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Optional authentication - attaches user if token present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(' ')[1] || req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          discordId: true,
          discordUsername: true,
          avatar: true,
          emailVerified: true,
        },
      });
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

/**
 * Check if user is at least a moderator
 */
const requireModerator = requireRole('MODERATOR', 'ADMIN', 'OWNER');

/**
 * Check if user is at least an admin
 */
const requireAdmin = requireRole('ADMIN', 'OWNER');

/**
 * Check if user is owner only
 */
const requireOwner = requireRole('OWNER');

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  requireModerator,
  requireAdmin,
  requireOwner,
};

