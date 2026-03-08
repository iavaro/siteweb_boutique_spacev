/**
 * SpaceV - Player Routes
 * =====================
 * Player profile and stats endpoints.
 * 
 * Endpoints:
 * - GET /api/players/:id - Get player profile
 * - GET /api/players/:id/stats - Get player stats
 * - GET /api/players/:id/inventory - Get player inventory
 * - GET /api/players/:id/assets - Get player assets
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const playerStatsService = require('../services/playerStatsService');
const inventorySyncService = require('../services/inventorySyncService');
const { optionalAuth } = require('../middlewares/auth');

// Apply optional auth to all routes
router.use(optionalAuth);

// ==============================================
// GET /api/players/:id - Get player profile
// ==============================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const profile = await playerStatsService.getPlayerProfile(id);
    
    if (!profile) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Format response (hide sensitive data)
    res.json({
      success: true,
      player: {
        id: profile.id,
        playerName: profile.playerName,
        avatar: profile.avatar,
        discordId: profile.discordId,
        rpScore: profile.rpScore,
        isBanned: profile.isBanned,
        lastSeen: profile.lastSeen,
        createdAt: profile.createdAt,
        stats: profile.stats ? {
          money: profile.stats.money,
          bank: profile.stats.bank,
          totalWealth: parseFloat(profile.stats.money) + parseFloat(profile.stats.bank),
          playtime: profile.stats.playtime,
          playtimeFormatted: formatPlaytime(profile.stats.playtime),
          kills: profile.stats.kills,
          deaths: profile.stats.deaths,
          kdRatio: profile.stats.deaths ? 
            (profile.stats.kills / profile.stats.deaths).toFixed(2) : 
            profile.stats.kills,
          vehiclesOwned: profile.stats.vehiclesOwned,
          housesOwned: profile.stats.housesOwned,
          totalEarnings: profile.stats.totalEarnings,
          totalSpent: profile.stats.totalSpent
        } : null,
        job: profile.job ? {
          job: profile.job.job,
          jobLabel: profile.job.jobLabel,
          jobGrade: profile.job.jobGrade,
          onDuty: profile.job.onDuty,
          salary: profile.job.salary
        } : null,
        ranks: profile.ranks,
        assetCount: profile.assets?.length || 0,
        inventoryCount: profile._count?.inventory || 0
      }
    });
  } catch (error) {
    console.error('Player profile error:', error);
    res.status(500).json({ error: 'Failed to get player profile' });
  }
});

// ==============================================
// GET /api/players/:id/stats - Get player stats
// ==============================================
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const player = await playerStatsService.getPlayerByIdentifier(id);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    if (!player.stats) {
      return res.status(404).json({ error: 'Stats not found for this player' });
    }
    
    res.json({
      success: true,
      playerId: player.id,
      playerName: player.playerName,
      stats: {
        money: player.stats.money,
        bank: player.stats.bank,
        blackMoney: player.stats.blackMoney,
        totalWealth: parseFloat(player.stats.money) + parseFloat(player.stats.bank),
        playtime: player.stats.playtime,
        playtimeFormatted: formatPlaytime(player.stats.playtime),
        kills: player.stats.kills,
        deaths: player.stats.deaths,
        kdRatio: player.stats.deaths ? 
          (player.stats.kills / player.stats.deaths).toFixed(2) : 
          player.stats.kills,
        vehiclesOwned: player.stats.vehiclesOwned,
        housesOwned: player.stats.housesOwned,
        totalPurchases: player.stats.totalPurchases,
        inventoryValue: player.stats.inventoryValue,
        totalEarnings: player.stats.totalEarnings,
        totalSpent: player.stats.totalSpent,
        lastUpdated: player.stats.lastUpdated
      }
    });
  } catch (error) {
    console.error('Player stats error:', error);
    res.status(500).json({ error: 'Failed to get player stats' });
  }
});

// ==============================================
// GET /api/players/:id/inventory - Get player inventory
// ==============================================
router.get('/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;
    
    const inventory = await inventorySyncService.getInventoryById(id);
    
    res.json({
      success: true,
      inventory: {
        playerId: inventory.playerId,
        items: inventory.items,
        grouped: inventory.grouped,
        itemCount: inventory.itemCount,
        totalValue: inventory.totalValue
      }
    });
  } catch (error) {
    console.error('Player inventory error:', error);
    res.status(500).json({ error: 'Failed to get player inventory' });
  }
});

// ==============================================
// GET /api/players/:id/assets - Get player assets
// ==============================================
router.get('/:id/assets', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    const player = await playerStatsService.getPlayerByIdentifier(id);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    let assets = player.assets || [];
    
    // Filter by type if specified
    if (type) {
      assets = assets.filter(a => a.type === type);
    }
    
    // Group by type
    const grouped = assets.reduce((acc, asset) => {
      if (!acc[asset.type]) {
        acc[asset.type] = [];
      }
      acc[asset.type].push(asset);
      return acc;
    }, {});
    
    res.json({
      success: true,
      playerId: player.id,
      playerName: player.playerName,
      assets: assets.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        label: a.label,
        value: a.value,
        properties: a.properties,
        createdAt: a.createdAt
      })),
      grouped,
      totalAssets: assets.length,
      totalValue: assets.reduce((sum, a) => sum + parseFloat(a.value || 0), 0)
    });
  } catch (error) {
    console.error('Player assets error:', error);
    res.status(500).json({ error: 'Failed to get player assets' });
  }
});

// ==============================================
// GET /api/players/search - Search players
// ==============================================
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    if (!search || search.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const players = await prisma.rPPlayer.findMany({
      where: {
        playerName: { contains: search }
      },
      include: {
        stats: true,
        job: true,
        _count: {
          select: { assets: true, inventory: true }
        }
      },
      orderBy: { lastSeen: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });
    
    const total = await prisma.rPPlayer.count({
      where: {
        playerName: { contains: search }
      }
    });
    
    res.json({
      success: true,
      players: players.map(p => ({
        id: p.id,
        playerName: p.playerName,
        avatar: p.avatar,
        rpScore: p.rpScore,
        isBanned: p.isBanned,
        lastSeen: p.lastSeen,
        job: p.job?.job || 'unemployed',
        jobLabel: p.job?.jobLabel || 'Unemployed',
        money: p.stats?.money || 0,
        playtime: p.stats?.playtime || 0,
        playtimeFormatted: formatPlaytime(p.stats?.playtime || 0),
        assets: p._count.assets,
        inventory: p._count.inventory
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Player search error:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

// Helper function to format playtime
function formatPlaytime(minutes) {
  if (!minutes) return '0h';
  
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

module.exports = router;

