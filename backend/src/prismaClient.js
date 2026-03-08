/**
 * SpaceV - Prisma Client
 * ======================
 * Singleton Prisma client instance for database operations.
 * This prevents multiple connections during development hot-reloading.
 * 
 * @usage: const prisma = require('./prismaClient');
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Export singleton instance
module.exports = prisma;

