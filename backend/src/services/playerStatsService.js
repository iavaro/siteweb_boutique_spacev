/**
 * SpaceV - Player Stats Service
 * ==============================
 * Handles player statistics tracking, updates, and leaderboard calculations.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const prisma = require('../prismaClient');

/**
 * Create or get player
 */
const getOrCreatePlayer = async (identifiers, playerName) => {
  const { license, discordId, steamId, liveId, xboxId } = identifiers;
  
  // Try to find by license first
  let player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (player) {
    // Update additional identifiers
    player = await prisma.rPPlayer.update({
      where: { id: player.id },
      data: {
        playerName,
        discordId: discordId || player.discordId,
        steamId: steamId || player.steamId,
        liveId: liveId || player.liveId,
        xboxId: xboxId || player.xboxId,
        lastSeen: new Date()
      }
    });
  } else {
    // Create new player
    player = await prisma.rPPlayer.create({
      data: {
        license,
        discordId,
        steamId,
        liveId,
        xboxId,
        playerName,
        rpScore: 1000
      }
    });
    
    // Create default stats
    await prisma.playerStats.create({
      data: {
        playerId: player.id
      }
    });
    
    // Create default job
    await prisma.playerJob.create({
      data: {
        playerId: player.id
      }
    });
  }
  
  return player;
};

/**
 * Update player stats
 */
const updateStats = async (license, statsData) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license },
    include: { stats: true }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Calculate changes for earnings/spent tracking
  const currentMoney = parseFloat(player.stats?.money || 0);
  const newMoney = parseFloat(statsData.money || currentMoney);
  
  let totalEarnings = parseFloat(player.stats?.totalEarnings || 0);
  let totalSpent = parseFloat(player.stats?.totalSpent || 0);
  
  if (newMoney > currentMoney) {
    totalEarnings += (newMoney - currentMoney);
  } else if (newMoney < currentMoney) {
    totalSpent += (currentMoney - newMoney);
  }
  
  // Update stats
  const updatedStats = await prisma.playerStats.upsert({
    where: { playerId: player.id },
    update: {
      ...(statsData.money !== undefined && { money: statsData.money }),
      ...(statsData.bank !== undefined && { bank: statsData.bank }),
      ...(statsData.blackMoney !== undefined && { blackMoney: statsData.blackMoney }),
      ...(statsData.playtime !== undefined && { playtime: statsData.playtime }),
      ...(statsData.kills !== undefined && { kills: statsData.kills }),
      ...(statsData.deaths !== undefined && { deaths: statsData.deaths }),
      ...(statsData.vehiclesOwned !== undefined && { vehiclesOwned: statsData.vehiclesOwned }),
      ...(statsData.housesOwned !== undefined && { housesOwned: statsData.housesOwned }),
      ...(statsData.totalPurchases !== undefined && { totalPurchases: statsData.totalPurchases }),
      ...(statsData.inventoryValue !== undefined && { inventoryValue: statsData.inventoryValue }),
      totalEarnings,
      totalSpent,
      lastUpdated: new Date()
    },
    create: {
      playerId: player.id,
      money: statsData.money || 0,
      bank: statsData.bank || 0,
      blackMoney: statsData.blackMoney || 0,
      playtime: statsData.playtime || 0,
      kills: statsData.kills || 0,
      deaths: statsData.deaths || 0,
      vehiclesOwned: statsData.vehiclesOwned || 0,
      housesOwned: statsData.housesOwned || 0,
      totalPurchases: statsData.totalPurchases || 0,
      inventoryValue: statsData.inventoryValue || 0,
      totalEarnings,
      totalSpent
    }
  });
  
  // Update player last seen
  await prisma.rPPlayer.update({
    where: { id: player.id },
    data: { lastSeen: new Date() }
  });
  
  // Emit WebSocket event
  if (global.io) {
    global.io.emit('player:stats-updated', {
      playerId: player.id,
      stats: updatedStats
    });
  }
  
  return updatedStats;
};

/**
 * Update player job
 */
const updateJob = async (license, jobData) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  const updatedJob = await prisma.playerJob.upsert({
    where: { playerId: player.id },
    update: {
      ...(jobData.job !== undefined && { job: jobData.job }),
      ...(jobData.jobGrade !== undefined && { jobGrade: jobData.jobGrade }),
      ...(jobData.jobLabel !== undefined && { jobLabel: jobData.jobLabel }),
      ...(jobData.onDuty !== undefined && { onDuty: jobData.onDuty }),
      ...(jobData.salary !== undefined && { salary: jobData.salary }),
      lastUpdated: new Date()
    },
    create: {
      playerId: player.id,
      job: jobData.job || 'unemployed',
      jobGrade: jobData.jobGrade || 0,
      jobLabel: jobData.jobLabel || 'Unemployed',
      onDuty: jobData.onDuty || false,
      salary: jobData.salary || 0
    }
  });
  
  // Emit WebSocket event
  if (global.io) {
    global.io.emit('player:job-updated', {
      playerId: player.id,
      job: updatedJob
    });
  }
  
  return updatedJob;
};

/**
 * Add player asset (vehicle, house, business)
 */
const addAsset = async (license, assetData) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Update stats counts
  if (assetData.type === 'VEHICLE') {
    await prisma.playerStats.update({
      where: { playerId: player.id },
      data: {
        vehiclesOwned: { increment: 1 }
      }
    });
  } else if (assetData.type === 'HOUSE') {
    await prisma.playerStats.update({
      where: { playerId: player.id },
      data: {
        housesOwned: { increment: 1 }
      }
    });
  }
  
  const asset = await prisma.playerAsset.create({
    data: {
      playerId: player.id,
      type: assetData.type,
      name: assetData.name,
      label: assetData.label,
      value: assetData.value || 0,
      properties: assetData.properties || {}
    }
  });
  
  return asset;
};

/**
 * Remove player asset
 */
const removeAsset = async (license, assetId) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  const asset = await prisma.playerAsset.findFirst({
    where: {
      id: assetId,
      playerId: player.id
    }
  });
  
  if (!asset) {
    throw new Error('Asset not found');
  }
  
  // Update stats counts
  if (asset.type === 'VEHICLE') {
    await prisma.playerStats.update({
      where: { playerId: player.id },
      data: {
        vehiclesOwned: { decrement: 1 }
      }
    });
  } else if (asset.type === 'HOUSE') {
    await prisma.playerStats.update({
      where: { playerId: player.id },
      data: {
        housesOwned: { decrement: 1 }
      }
    });
  }
  
  await prisma.playerAsset.delete({
    where: { id: assetId }
  });
  
  return { success: true };
};

/**
 * Get player by various identifiers
 */
const getPlayerByIdentifier = async (identifier) => {
  // Try to find by any identifier
  const player = await prisma.rPPlayer.findFirst({
    where: {
      OR: [
        { license: identifier },
        { discordId: identifier },
        { steamId: identifier },
        { liveId: identifier },
        { xboxId: identifier },
        { id: parseInt(identifier) || 0 }
      ]
    },
    include: {
      stats: true,
      job: true,
      assets: true,
      _count: {
        select: { inventory: true }
      }
    }
  });
  
  return player;
};

/**
 * Get player full profile
 */
const getPlayerProfile = async (playerId) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { id: parseInt(playerId) },
    include: {
      stats: true,
      job: true,
      assets: true,
      inventory: {
        orderBy: { count: 'desc' }
      }
    }
  });
  
  if (!player) {
    return null;
  }
  
  // Calculate rank positions
  const ranks = await Promise.all([
    getLeaderboard('money', 1, 1000),
    getLeaderboard('playtime', 1, 1000),
    getLeaderboard('kills', 1, 1000),
    getLeaderboard('vehicles', 1, 1000)
  ]);
  
  const moneyRank = ranks[0].findIndex(p => p.player.id === player.id) + 1;
  const playtimeRank = ranks[1].findIndex(p => p.player.id === player.id) + 1;
  const killsRank = ranks[2].findIndex(p => p.player.id === player.id) + 1;
  const vehiclesRank = ranks[3].findIndex(p => p.player.id === player.id) + 1;
  
  return {
    ...player,
    ranks: {
      money: moneyRank || null,
      playtime: playtimeRank || null,
      kills: killsRank || null,
      vehicles: vehiclesRank || null
    }
  };
};

/**
 * Get leaderboard
 */
const getLeaderboard = async (type, page = 1, limit = 10) => {
  let orderBy;
  let select;
  
  switch (type) {
    case 'money':
      orderBy = { money: 'desc' };
      select = {
        player: {
          include: {
            stats: {
              select: {
                money: true,
                bank: true,
                playtime: true,
                kills: true,
                vehiclesOwned: true,
                housesOwned: true
              }
            },
            job: true
          }
        },
        totalWealth: true
      };
      break;
    case 'playtime':
      orderBy = { playtime: 'desc' };
      select = {
        player: {
          include: {
            stats: true,
            job: true
          }
        }
      };
      break;
    case 'kills':
      orderBy = { kills: 'desc' };
      select = {
        player: {
          include: {
            stats: true,
            job: true
          }
        }
      };
      break;
    case 'deaths':
      orderBy = { deaths: 'desc' };
      select = {
        player: {
          include: {
            stats: true,
            job: true
          }
        }
      };
      break;
    case 'vehicles':
      orderBy = { vehiclesOwned: 'desc' };
      select = {
        player: {
          include: {
            stats: true,
            job: true
          }
        }
      };
      break;
    case 'houses':
      orderBy = { housesOwned: 'desc' };
      select = {
        player: {
          include: {
            stats: true,
            job: true
          }
        }
      };
      break;
    case 'rpScore':
      orderBy = { player: { rpScore: 'desc' } };
      select = {
        player: {
          include: {
            stats: true,
            job: true
          }
        }
      };
      break;
    default:
      orderBy = { money: 'desc' };
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  let players;
  
  if (type === 'money') {
    // Special query for wealth calculation
    players = await prisma.playerStats.findMany({
      include: {
        player: {
          include: {
            job: true
          }
        }
      },
      orderBy: { money: 'desc' },
      skip,
      take: parseInt(limit)
    });
    
    players = players.map(p => ({
      player: p.player,
      totalWealth: parseFloat(p.money) + parseFloat(p.bank)
    }));
  } else if (type === 'rpScore') {
    players = await prisma.rPPlayer.findMany({
      include: {
        stats: true,
        job: true
      },
      orderBy: { rpScore: 'desc' },
      skip,
      take: parseInt(limit)
    });
    
    players = players.map(p => ({ player: p }));
  } else {
    const stats = await prisma.playerStats.findMany({
      include: {
        player: {
          include: {
            job: true
          }
        }
      },
      orderBy,
      skip,
      take: parseInt(limit)
    });
    
    players = stats.map(s => ({
      player: s.player,
      [type]: s[type]
    }));
  }
  
  return players;
};

/**
 * Get all leaderboard types
 */
const getAllLeaderboards = async (limit = 10) => {
  const [richest, mostPlaytime, mostKills, mostVehicles, mostHouses, bestRpScore] = await Promise.all([
    getLeaderboard('money', 1, limit),
    getLeaderboard('playtime', 1, limit),
    getLeaderboard('kills', 1, limit),
    getLeaderboard('vehicles', 1, limit),
    getLeaderboard('houses', 1, limit),
    getLeaderboard('rpScore', 1, limit)
  ]);
  
  return {
    richest,
    mostPlaytime,
    mostKills,
    mostVehicles,
    mostHouses,
    bestRpScore
  };
};

/**
 * Reset player stats
 */
const resetStats = async (playerId) => {
  await prisma.playerStats.update({
    where: { playerId: parseInt(playerId) },
    data: {
      money: 0,
      bank: 0,
      blackMoney: 0,
      playtime: 0,
      kills: 0,
      deaths: 0,
      vehiclesOwned: 0,
      housesOwned: 0,
      totalPurchases: 0,
      inventoryValue: 0,
      totalEarnings: 0,
      totalSpent: 0,
      lastUpdated: new Date()
    }
  });
  
  return { success: true };
};

/**
 * Get player list with pagination
 */
const getPlayers = async (filters = {}) => {
  const { page = 1, limit = 20, search, job, banned } = filters;
  
  const where = {};
  
  if (banned !== undefined) {
    where.isBanned = banned === 'true';
  }
  
  if (search) {
    where.OR = [
      { playerName: { contains: search } },
      { license: { contains: search } }
    ];
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [players, total] = await Promise.all([
    prisma.rPPlayer.findMany({
      where,
      include: {
        stats: true,
        job: true,
        _count: {
          select: { assets: true, inventory: true }
        }
      },
      orderBy: { lastSeen: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.rPPlayer.count({ where })
  ]);
  
  return {
    players,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  };
};

/**
 * Link RP player to website user
 */
const linkToUser = async (playerId, userId) => {
  return prisma.rPPlayer.update({
    where: { id: parseInt(playerId) },
    data: { userId: parseInt(userId) }
  });
};

module.exports = {
  getOrCreatePlayer,
  updateStats,
  updateJob,
  addAsset,
  removeAsset,
  getPlayerByIdentifier,
  getPlayerProfile,
  getLeaderboard,
  getAllLeaderboards,
  resetStats,
  getPlayers,
  linkToUser
};

