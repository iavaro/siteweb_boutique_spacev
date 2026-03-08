/**
 * SpaceV - FiveM Routes
 * ======================
 * Handles FiveM server integration endpoints.
 * 
 * Endpoints:
 * - POST /api/fivem/anticheat - Anti-cheat event logging
 * - POST /api/fivem/player/update-stats - Player stats updates
 * - POST /api/fivem/player/inventory - Inventory sync
 * - POST /api/fivem/player/job - Job update
 * - POST /api/fivem/player/asset - Asset management
 * - GET /api/fivem/server/status - Server status check
 * - POST /api/fivem/server/heartbeat - Server heartbeat
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../prismaClient');

// Import services
const anticheatService = require('../services/anticheatService');
const playerStatsService = require('../services/playerStatsService');
const inventorySyncService = require('../services/inventorySyncService');

// Middleware to validate FiveM server API key
const validateServerKey = async (req, res, next) => {
  const apiKey = req.headers['x-fivem-api-key'] || req.body.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const server = await prisma.fiveMServer.findUnique({
    where: { apiKey }
  });
  
  if (!server) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  if (!server.isActive) {
    return res.status(403).json({ error: 'Server is disabled' });
  }
  
  req.fivemServer = server;
  next();
};

// Apply validation to all routes
router.use(validateServerKey);

// ==============================================
// POST /api/fivem/anticheat - Log anti-cheat event
// ==============================================
router.post('/anticheat', [
  body('playerName').notEmpty().trim(),
  body('license').notEmpty().trim(),
  body('event').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { playerName, license, event, value, details, evidence } = req.body;
    
    const anticheatEvent = await anticheatService.logEvent({
      playerName,
      license,
      event,
      value,
      details,
      evidence,
      serverId: req.fivemServer.id
    });
    
    res.json({
      success: true,
      eventId: anticheatEvent.id,
      severity: anticheatEvent.severity,
      flagged: anticheatEvent.flagged
    });
  } catch (error) {
    console.error('Anti-cheat error:', error);
    res.status(500).json({ error: 'Failed to log anti-cheat event' });
  }
});

// ==============================================
// POST /api/fivem/player/update-stats - Update player stats
// ==============================================
router.post('/player/update-stats', [
  body('license').notEmpty().trim(),
  body('playerName').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { license, playerName, identifiers = {}, stats = {} } = req.body;
    
    // Get or create player
    const player = await playerStatsService.getOrCreatePlayer(
      { license, ...identifiers },
      playerName
    );
    
    // Update stats if provided
    if (Object.keys(stats).length > 0) {
      await playerStatsService.updateStats(license, stats);
    }
    
    res.json({
      success: true,
      playerId: player.id,
      playerName: player.playerName
    });
  } catch (error) {
    console.error('Player stats update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update player stats' });
  }
});

// ==============================================
// POST /api/fivem/player/inventory - Sync inventory
// ==============================================
router.post('/player/inventory', [
  body('license').notEmpty().trim(),
  body('items').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { license, items } = req.body;
    
    const result = await inventorySyncService.syncInventory(license, items);
    
    // Check for suspicious inventory
    const suspiciousCheck = await inventorySyncService.checkSuspiciousInventory(license);
    
    if (suspiciousCheck.suspicious) {
      // Log suspicious inventory as anti-cheat event
      await anticheatService.logEvent({
        playerName: suspiciousCheck.player.name,
        license,
        event: 'INVENTORY_OVERFLOW',
        value: suspiciousCheck.issues[0]?.value,
        details: suspiciousCheck.issues,
        serverId: req.fivemServer.id
      });
    }
    
    res.json({
      success: true,
      playerId: result.playerId,
      itemCount: result.itemCount,
      totalValue: result.totalValue,
      suspicious: suspiciousCheck.suspicious
    });
  } catch (error) {
    console.error('Inventory sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync inventory' });
  }
});

// ==============================================
// POST /api/fivem/player/job - Update player job
// ==============================================
router.post('/player/job', [
  body('license').notEmpty().trim(),
  body('job').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { license, job, jobGrade, jobLabel, onDuty, salary } = req.body;
    
    const jobData = { job, jobGrade, jobLabel, onDuty, salary };
    
    // Filter out undefined values
    Object.keys(jobData).forEach(key => {
      if (jobData[key] === undefined) delete jobData[key];
    });
    
    const result = await playerStatsService.updateJob(license, jobData);
    
    res.json({
      success: true,
      job: result
    });
  } catch (error) {
    console.error('Job update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update job' });
  }
});

// ==============================================
// POST /api/fivem/player/asset - Add/remove asset
// ==============================================
router.post('/player/asset', [
  body('license').notEmpty().trim(),
  body('action').isIn(['add', 'remove']),
  body('type').isIn(['VEHICLE', 'HOUSE', 'BUSINESS']),
  body('name').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { license, action, type, name, label, value, properties } = req.body;
    
    if (action === 'add') {
      const asset = await playerStatsService.addAsset(license, {
        type,
        name,
        label: label || name,
        value: value || 0,
        properties
      });
      
      res.json({
        success: true,
        action: 'added',
        asset
      });
    } else {
      const assetId = req.body.assetId;
      
      if (!assetId) {
        return res.status(400).json({ error: 'assetId required for remove action' });
      }
      
      await playerStatsService.removeAsset(license, assetId);
      
      res.json({
        success: true,
        action: 'removed'
      });
    }
  } catch (error) {
    console.error('Asset management error:', error);
    res.status(500).json({ error: error.message || 'Failed to manage asset' });
  }
});

// ==============================================
// GET /api/fivem/server/status - Server status
// ==============================================
router.get('/server/status', async (req, res) => {
  try {
    const server = req.fivemServer;
    
    res.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        ipAddress: server.ipAddress,
        port: server.port,
        isActive: server.isActive
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Server status error:', error);
    res.status(500).json({ error: 'Failed to get server status' });
  }
});

// ==============================================
// POST /api/fivem/server/heartbeat - Server heartbeat
// ==============================================
router.post('/server/heartbeat', async (req, res) => {
  try {
    const server = req.fivemServer;
    
    await prisma.fiveMServer.update({
      where: { id: server.id },
      data: {
        lastHeartbeat: new Date()
      }
    });
    
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

// ==============================================
// POST /api/fivem/player/identify - Player identification
// ==============================================
router.post('/player/identify', [
  body('license').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { license, identifiers = {} } = req.body;
    
    // Find or create player
    const player = await playerStatsService.getOrCreatePlayer(
      { license, ...identifiers },
      identifiers.playerName || 'Unknown'
    );
    
    // Get full profile
    const profile = await playerStatsService.getPlayerProfile(player.id);
    
    res.json({
      success: true,
      player: {
        id: player.id,
        playerName: player.playerName,
        license: player.license,
        isBanned: player.isBanned,
        banReason: player.banReason,
        rpScore: player.rpScore,
        discordId: player.discordId
      },
      profile
    });
  } catch (error) {
    console.error('Player identify error:', error);
    res.status(500).json({ error: error.message || 'Failed to identify player' });
  }
});

// ==============================================
// GET /api/fivem/leaderboards - Get leaderboards
// ==============================================
router.get('/leaderboards', async (req, res) => {
  try {
    const { type = 'money', limit = 10 } = req.query;
    
    const leaderboard = await playerStatsService.getLeaderboard(type, 1, parseInt(limit));
    
    res.json({
      success: true,
      type,
      leaderboard
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

module.exports = router;

