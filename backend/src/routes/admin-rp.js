/**
 * SpaceV - Admin RP Routes
 * =======================
 * Admin endpoints for RP player management, anti-cheat, and more.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const anticheatService = require('../services/anticheatService');
const playerStatsService = require('../services/playerStatsService');
const inventorySyncService = require('../services/inventorySyncService');

// Apply admin authentication to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// ==============================================
// GET /api/admin-rp/anticheat - Anti-cheat events
// ==============================================
router.get('/anticheat', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, severity, eventType, flagged, resolved, search } = req.query;
  
  const result = await anticheatService.getEvents({
    page: parseInt(page),
    limit: parseInt(limit),
    severity,
    eventType,
    flagged: flagged === 'true',
    resolved: resolved === 'true',
    playerName: search
  });
  
  res.json(result);
}));

// ==============================================
// GET /api/admin-rp/anticheat/stats - Anti-cheat statistics
// ==============================================
router.get('/anticheat/stats', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  
  const stats = await anticheatService.getStats(parseInt(days));
  
  res.json(stats);
}));

// ==============================================
// GET /api/admin-rp/anticheat/flagged - Flagged players
// ==============================================
router.get('/anticheat/flagged', asyncHandler(async (req, res) => {
  const flagged = await anticheatService.getFlaggedPlayers();
  
  res.json({ flaggedPlayers: flagged });
}));

// ==============================================
// PUT /api/admin-rp/anticheat/:id/resolve - Resolve event
// ==============================================
router.put('/anticheat/:id/resolve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  const event = await anticheatService.resolveEvent(parseInt(id), req.user.username, notes);
  
  res.json({ message: 'Event resolved', event });
}));

// ==============================================
// GET /api/admin-rp/players - RP Players list
// ==============================================
router.get('/players', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, job, banned } = req.query;
  
  const result = await playerStatsService.getPlayers({
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    job,
    banned
  });
  
  res.json(result);
}));

// ==============================================
// GET /api/admin-rp/players/:id - Get RP player details
// ==============================================
router.get('/players/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const player = await prisma.rPPlayer.findUnique({
    where: { id: parseInt(id) },
    include: {
      stats: true,
      job: true,
      assets: true,
      inventory: true,
      anticheatEvents: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });
  
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }
  
  res.json({ player });
}));

// ==============================================
// PUT /api/admin-rp/players/:id/ban - Ban player
// ==============================================
router.put('/players/:id/ban', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'Ban reason required' });
  }
  
  const player = await anticheatService.banPlayer(parseInt(id), reason, req.user.username);
  
  // Log the ban as anti-cheat event
  await anticheatService.logEvent({
    playerName: player.playerName,
    license: player.license,
    event: 'PLAYER_BANNED',
    details: { reason, bannedBy: req.user.username }
  });
  
  res.json({ message: 'Player banned', player });
}));

// ==============================================
// PUT /api/admin-rp/players/:id/unban - Unban player
// ==============================================
router.put('/players/:id/unban', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const player = await anticheatService.unbanPlayer(parseInt(id));
  
  res.json({ message: 'Player unbanned', player });
}));

// ==============================================
// PUT /api/admin-rp/players/:id/wipe-inventory - Wipe inventory
// ==============================================
router.put('/players/:id/wipe-inventory', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await inventorySyncService.wipeInventory(parseInt(id));
  
  // Log the action
  await anticheatService.logEvent({
    playerName: 'System',
    license: 'admin',
    event: 'INVENTORY_WIPED',
    details: { playerId: id, admin: req.user.username }
  });
  
  res.json({ message: 'Inventory wiped' });
}));

// ==============================================
// PUT /api/admin-rp/players/:id/reset-stats - Reset stats
// ==============================================
router.put('/players/:id/reset-stats', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await playerStatsService.resetStats(parseInt(id));
  
  // Log the action
  const player = await prisma.rPPlayer.findUnique({ where: { id: parseInt(id) } });
  await anticheatService.logEvent({
    playerName: player?.playerName || 'Unknown',
    license: player?.license || 'unknown',
    event: 'STATS_RESET',
    details: { playerId: id, admin: req.user.username }
  });
  
  res.json({ message: 'Stats reset' });
}));

// ==============================================
// PUT /api/admin-rp/players/:id/rpscore - Update RP score
// ==============================================
router.put('/players/:id/rpscore', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rpScore } = req.body;
  
  if (rpScore === undefined) {
    return res.status(400).json({ error: 'RP score required' });
  }
  
  const player = await prisma.rPPlayer.update({
    where: { id: parseInt(id) },
    data: { rpScore: parseInt(rpScore) }
  });
  
  res.json({ message: 'RP score updated', player });
}));

// ==============================================
// GET /api/admin-rp/servers - FiveM servers
// ==============================================
router.get('/servers', asyncHandler(async (req, res) => {
  const servers = await prisma.fiveMServer.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({ servers });
}));

// ==============================================
// POST /api/admin-rp/servers - Add FiveM server (with auto-generated API key)
// ==============================================
router.post('/servers', asyncHandler(async (req, res) => {
  const { name, ipAddress, port } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }
  
  // Auto-generate API key
  const apiKey = 'fivem_' + crypto.randomBytes(16).toString('hex');
  
  const server = await prisma.fiveMServer.create({
    data: {
      name,
      apiKey,
      ipAddress,
      port: port || 30120
    }
  });
  
  res.json({ message: 'Server created', server });
}));

// ==============================================
// POST /api/admin-rp/servers/generate-key - Generate new API key for existing server
// ==============================================
router.post('/servers/:id/regenerate-key', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Generate new API key
  const apiKey = 'fivem_' + crypto.randomBytes(16).toString('hex');
  
  const server = await prisma.fiveMServer.update({
    where: { id: parseInt(id) },
    data: { apiKey }
  });
  
  res.json({ message: 'API key regenerated', server });
}));

// ==============================================
// PUT /api/admin-rp/servers/:id - Update server
// ==============================================
router.put('/servers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, ipAddress, port, isActive } = req.body;
  
  const server = await prisma.fiveMServer.update({
    where: { id: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(ipAddress && { ipAddress }),
      ...(port && { port }),
      ...(isActive !== undefined && { isActive })
    }
  });
  
  res.json({ message: 'Server updated', server });
}));

// ==============================================
// DELETE /api/admin-rp/servers/:id - Delete server
// ==============================================
router.delete('/servers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await prisma.fiveMServer.delete({
    where: { id: parseInt(id) }
  });
  
  res.json({ message: 'Server deleted' });
}));

// ==============================================
// GET /api/admin-rp/webhooks - Discord webhooks
// ==============================================
router.get('/webhooks', asyncHandler(async (req, res) => {
  const webhooks = await prisma.discordWebhook.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({ webhooks });
}));

// ==============================================
// POST /api/admin-rp/webhooks - Add webhook
// ==============================================
router.post('/webhooks', asyncHandler(async (req, res) => {
  const { name, url, type } = req.body;
  
  if (!name || !url || !type) {
    return res.status(400).json({ error: 'Name, URL, and type required' });
  }
  
  const webhook = await prisma.discordWebhook.create({
    data: {
      name,
      url,
      type
    }
  });
  
  res.json({ message: 'Webhook created', webhook });
}));

// ==============================================
// PUT /api/admin-rp/webhooks/:id - Update webhook
// ==============================================
router.put('/webhooks/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, url, type, isActive } = req.body;
  
  const webhook = await prisma.discordWebhook.update({
    where: { id: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(url && { url }),
      ...(type && { type }),
      ...(isActive !== undefined && { isActive })
    }
  });
  
  res.json({ message: 'Webhook updated', webhook });
}));

// ==============================================
// DELETE /api/admin-rp/webhooks/:id - Delete webhook
// ==============================================
router.delete('/webhooks/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await prisma.discordWebhook.delete({
    where: { id: parseInt(id) }
  });
  
  res.json({ message: 'Webhook deleted' });
}));

module.exports = router;

