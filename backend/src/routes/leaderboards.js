/**
 * SpaceV - Leaderboard Routes
 * ===========================
 * Public leaderboard endpoints.
 * 
 * Endpoints:
 * - GET /api/leaderboards - Get all leaderboards
 * - GET /api/leaderboards/:type - Get specific leaderboard
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const playerStatsService = require('../services/playerStatsService');

// ==============================================
// GET /api/leaderboards - Get all leaderboards
// ==============================================
router.get('/', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const leaderboards = await playerStatsService.getAllLeaderboards(parseInt(limit));
    
    res.json({
      success: true,
      leaderboards: {
        richest: leaderboards.richest.map((entry, index) => ({
          rank: index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          money: entry.totalWealth,
          bank: entry.player.stats?.bank || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        })),
        mostPlaytime: leaderboards.mostPlaytime.map((entry, index) => ({
          rank: index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          playtime: entry.player.stats?.playtime || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        })),
        mostKills: leaderboards.mostKills.map((entry, index) => ({
          rank: index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          kills: entry.player.stats?.kills || 0,
          deaths: entry.player.stats?.deaths || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        })),
        mostVehicles: leaderboards.mostVehicles.map((entry, index) => ({
          rank: index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          vehicles: entry.player.stats?.vehiclesOwned || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        })),
        mostHouses: leaderboards.mostHouses.map((entry, index) => ({
          rank: index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          houses: entry.player.stats?.housesOwned || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        })),
        bestRpScore: leaderboards.bestRpScore.map((entry, index) => ({
          rank: index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          rpScore: entry.player.rpScore || 1000,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }))
      }
    });
  } catch (error) {
    console.error('Leaderboards error:', error);
    res.status(500).json({ error: 'Failed to get leaderboards' });
  }
});

// ==============================================
// GET /api/leaderboards/:type - Get specific leaderboard
// ==============================================
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Validate type
    const validTypes = ['money', 'playtime', 'kills', 'deaths', 'vehicles', 'houses', 'rpScore'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Invalid leaderboard type. Valid types: ${validTypes.join(', ')}` 
      });
    }
    
    const leaderboard = await playerStatsService.getLeaderboard(type, parseInt(page), parseInt(limit));
    
    // Format response based on type
    let formattedLeaderboard;
    switch (type) {
      case 'money':
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          money: entry.totalWealth,
          bank: entry.player.stats?.bank || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
        break;
      case 'playtime':
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          playtime: entry.player.stats?.playtime || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
        break;
      case 'kills':
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          kills: entry.player.stats?.kills || 0,
          deaths: entry.player.stats?.deaths || 0,
          kdRatio: entry.player.stats?.deaths ? 
            (entry.player.stats.kills / entry.player.stats.deaths).toFixed(2) : 
            entry.player.stats?.kills || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
        break;
      case 'vehicles':
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          vehicles: entry.player.stats?.vehiclesOwned || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
        break;
      case 'houses':
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          houses: entry.player.stats?.housesOwned || 0,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
        break;
      case 'rpScore':
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          rpScore: entry.player.rpScore || 1000,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
        break;
      default:
        formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: ((parseInt(page) - 1) * parseInt(limit)) + index + 1,
          playerId: entry.player.id,
          playerName: entry.player.playerName,
          avatar: entry.player.avatar,
          job: entry.player.job?.job || 'unemployed',
          jobLabel: entry.player.job?.jobLabel || 'Unemployed'
        }));
    }
    
    res.json({
      success: true,
      type,
      page: parseInt(page),
      limit: parseInt(limit),
      leaderboard: formattedLeaderboard
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

module.exports = router;

