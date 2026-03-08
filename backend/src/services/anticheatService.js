/**
 * SpaceV - Anti-Cheat Service
 * ============================
 * Handles anti-cheat event logging, severity classification, and alerts.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const prisma = require('../prismaClient');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const { v4: uuidv4 } = require('uuid');

// Severity thresholds for different exploit types
const SEVERITY_THRESHOLDS = {
  MONEY_EXPLOIT: {
    LOW: 10000,
    MEDIUM: 100000,
    HIGH: 1000000,
    CRITICAL: 5000000
  },
  ITEM_DUPLICATION: {
    LOW: 5,
    MEDIUM: 50,
    HIGH: 500,
    CRITICAL: 5000
  },
  TELEPORT_HACK: {
    LOW: 100, // meters
    MEDIUM: 500,
    HIGH: 2000,
    CRITICAL: 10000
  },
  SPEED_HACK: {
    LOW: 20, // km/h over limit
    MEDIUM: 50,
    HIGH: 100,
    CRITICAL: 200
  },
  INVENTORY_OVERFLOW: {
    LOW: 50,
    MEDIUM: 100,
    HIGH: 200,
    CRITICAL: 500
  },
  IMPOSSIBLE_JOB_PAYOUT: {
    LOW: 5000,
    MEDIUM: 50000,
    HIGH: 500000,
    CRITICAL: 5000000
  }
};

/**
 * Determine severity based on event type and value
 */
const determineSeverity = (eventType, value) => {
  if (!value) return 'LOW';
  
  const thresholds = SEVERITY_THRESHOLDS[eventType] || SEVERITY_THRESHOLDS['MONEY_EXPLOIT'];
  const numValue = parseFloat(value);
  
  if (numValue >= thresholds.CRITICAL) return 'CRITICAL';
  if (numValue >= thresholds.HIGH) return 'HIGH';
  if (numValue >= thresholds.MEDIUM) return 'MEDIUM';
  return 'LOW';
};

/**
 * Create or get player by license
 */
const getOrCreatePlayer = async (license, playerName) => {
  let player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    player = await prisma.rPPlayer.create({
      data: {
        license,
        playerName,
        rpScore: 1000
      }
    });
  } else {
    // Update player name if changed
    if (player.playerName !== playerName) {
      player = await prisma.rPPlayer.update({
        where: { id: player.id },
        data: { playerName }
      });
    }
  }
  
  return player;
};

/**
 * Log anti-cheat event
 */
const logEvent = async (data) => {
  const {
    playerName,
    license,
    event,
    value,
    details = {},
    evidence = null,
    serverId = 'unknown'
  } = data;
  
  // Get or create player
  const player = await getOrCreatePlayer(license, playerName);
  
  // Determine severity
  const severity = determineSeverity(event, value);
  const shouldFlag = severity === 'HIGH' || severity === 'CRITICAL';
  
  // Create anti-cheat event
  const anticheatEvent = await prisma.antiCheatEvent.create({
    data: {
      playerId: player.id,
      playerName,
      license,
      event,
      eventType: event,
      severity,
      value: value ? parseFloat(value) : null,
      details,
      evidence,
      flagged: shouldFlag
    }
  });
  
  // Update player stats if severe
  if (shouldFlag) {
    await prisma.rPPlayer.update({
      where: { id: player.id },
      data: { lastSeen: new Date() }
    });
  }
  
  // Send Discord alert for high severity
  if (shouldFlag) {
    sendDiscordAlert(anticheatEvent, player);
  }
  
  // Emit WebSocket event if available
  if (global.io && shouldFlag) {
    global.io.emit('anticheat:new', anticheatEvent);
  }
  
  return anticheatEvent;
};

/**
 * Send Discord alert for anti-cheat event
 */
const sendDiscordAlert = async (event, player) => {
  try {
    // Get webhook URL from database
    const webhook = await prisma.discordWebhook.findFirst({
      where: {
        type: 'anticheat',
        isActive: true
      }
    });
    
    if (!webhook) {
      console.log('No Discord anti-cheat webhook configured');
      return;
    }
    
    const webhookClient = new WebhookClient({ url: webhook.url });
    
    const severityColors = {
      LOW: 0x10b981,     // Green
      MEDIUM: 0xf59e0b, // Yellow
      HIGH: 0xf97316,    // Orange
      CRITICAL: 0xef4444 // Red
    };
    
    const embed = new EmbedBuilder()
      .setColor(severityColors[event.severity] || 0xef4444)
      .setTitle(`🚨 Anti-Cheat Alert: ${event.severity}`)
      .addFields(
        { name: 'Player', value: event.playerName, inline: true },
        { name: 'License', value: `\`${event.license.slice(0, 15)}...\``, inline: true },
        { name: 'Event', value: formatEventType(event.event), inline: false },
        { name: 'Value', value: event.value ? `$${parseFloat(event.value).toLocaleString()}` : 'N/A', inline: true },
        { name: 'Severity', value: event.severity, inline: true },
        { name: 'Time', value: new Date(event.createdAt).toLocaleString(), inline: false }
      )
      .setTimestamp(event.createdAt)
      .setFooter({ text: 'SpaceV Anti-Cheat System' });
    
    if (event.evidence) {
      embed.addFields({ name: 'Evidence', value: event.evidence.slice(0, 500), inline: false });
    }
    
    await webhookClient.send({
      embeds: [embed]
    });
    
    // Mark as sent Discord alert
    await prisma.antiCheatEvent.update({
      where: { id: event.id },
      data: { discordAlert: true }
    });
    
    console.log(`📢 Discord anti-cheat alert sent for ${event.playerName}`);
    
  } catch (error) {
    console.error('Failed to send Discord anti-cheat alert:', error.message);
  }
};

/**
 * Format event type for display
 */
const formatEventType = (eventType) => {
  return eventType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Get all anti-cheat events with filters
 */
const getEvents = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    severity,
    eventType,
    flagged,
    resolved,
    playerName
  } = filters;
  
  const where = {};
  
  if (severity) where.severity = severity;
  if (eventType) where.eventType = eventType;
  if (flagged !== undefined) where.flagged = flagged;
  if (resolved !== undefined) where.resolved = resolved;
  if (playerName) {
    where.playerName = { contains: playerName };
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [events, total] = await Promise.all([
    prisma.antiCheatEvent.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            playerName: true,
            license: true,
            isBanned: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.antiCheatEvent.count({ where })
  ]);
  
  return {
    events,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  };
};

/**
 * Get flagged players
 */
const getFlaggedPlayers = async () => {
  const events = await prisma.antiCheatEvent.findMany({
    where: {
      flagged: true,
      resolved: false
    },
    include: {
      player: {
        select: {
          id: true,
          playerName: true,
          license: true,
          isBanned: true,
          lastSeen: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Group by player
  const playerMap = new Map();
  events.forEach(event => {
    const playerId = event.player.id;
    if (!playerMap.has(playerId)) {
      playerMap.set(playerId, {
        player: event.player,
        eventCount: 0,
        latestEvent: event,
        severities: new Set()
      });
    }
    const playerData = playerMap.get(playerId);
    playerData.eventCount++;
    playerData.severities.add(event.severity);
  });
  
  return Array.from(playerMap.values()).map(p => ({
    ...p,
    severities: Array.from(p.severities)
  }));
};

/**
 * Resolve anti-cheat event
 */
const resolveEvent = async (eventId, resolvedBy, notes = '') => {
  return prisma.antiCheatEvent.update({
    where: { id: eventId },
    data: {
      resolved: true,
      resolvedBy,
      resolvedAt: new Date()
    }
  });
};

/**
 * Ban player
 */
const banPlayer = async (playerId, reason, bannedBy) => {
  return prisma.rPPlayer.update({
    where: { id: playerId },
    data: {
      isBanned: true,
      banReason: reason,
      bannedAt: new Date(),
      bannedBy
    }
  });
};

/**
 * Unban player
 */
const unbanPlayer = async (playerId) => {
  return prisma.rPPlayer.update({
    where: { id: playerId },
    data: {
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null
    }
  });
};

/**
 * Get anti-cheat statistics
 */
const getStats = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const [
    totalEvents,
    eventsBySeverity,
    eventsByType,
    topPlayers,
    recentEvents
  ] = await Promise.all([
    prisma.antiCheatEvent.count({
      where: { createdAt: { gte: startDate } }
    }),
    prisma.antiCheatEvent.groupBy({
      by: ['severity'],
      _count: true,
      where: { createdAt: { gte: startDate } }
    }),
    prisma.antiCheatEvent.groupBy({
      by: ['eventType'],
      _count: true,
      where: { createdAt: { gte: startDate } },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }),
    prisma.antiCheatEvent.groupBy({
      by: ['playerName'],
      _count: true,
      where: { createdAt: { gte: startDate }, flagged: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }),
    prisma.antiCheatEvent.findMany({
      where: { createdAt: { gte: startDate } },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })
  ]);
  
  return {
    totalEvents,
    eventsBySeverity: eventsBySeverity.map(e => ({
      severity: e.severity,
      count: e._count
    })),
    eventsByType: eventsByType.map(e => ({
      type: e.eventType,
      count: e._count
    })),
    topPlayers: topPlayers.map(p => ({
      playerName: p.playerName,
      eventCount: p._count
    })),
    recentEvents
  };
};

module.exports = {
  logEvent,
  getEvents,
  getFlaggedPlayers,
  resolveEvent,
  banPlayer,
  unbanPlayer,
  getStats,
  determineSeverity,
  sendDiscordAlert
};

