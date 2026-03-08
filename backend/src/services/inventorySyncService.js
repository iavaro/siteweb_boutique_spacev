/**
 * SpaceV - Inventory Sync Service
 * ================================
 * Handles player inventory synchronization between FiveM and the web platform.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const prisma = require('../prismaClient');

// Item categories mapping
const ITEM_CATEGORIES = {
  // Weapons
  weapon_pistol: 'WEAPON',
  weapon_revolver: 'WEAPON',
  weapon_smg: 'WEAPON',
  weapon_rifle: 'WEAPON',
  weapon_shotgun: 'WEAPON',
  weapon_sniper: 'WEAPON',
  weapon_knife: 'WEAPON',
  weapon_bat: 'WEAPON',
  
  // Food
  bread: 'FOOD',
  burger: 'FOOD',
  pizza: 'FOOD',
  sandwich: 'FOOD',
  hotdog: 'FOOD',
  taco: 'FOOD',
  
  // Drinks
  water: 'DRINK',
  soda: 'DRINK',
  coffee: 'DRINK',
  beer: 'DRINK',
  wine: 'DRINK',
  whisky: 'DRINK',
  
  // Medical
  bandage: 'MEDICAL',
  medkit: 'MEDICAL',
  morphine: 'MEDICAL',
  firstaid: 'MEDICAL',
  
  // Clothing
  clothing: 'CLOTHING',
  outfit: 'CLOTHING',
  mask: 'CLOTHING',
  hat: 'CLOTHING',
  glasses: 'CLOTHING',
  
  // Keys
  key: 'KEY',
  carkey: 'KEY',
  housekey: 'KEY',
  
  // Documents
  id_card: 'DOCUMENT',
  driver_license: 'DOCUMENT',
  weapon_license: 'DOCUMENT',
  passport: 'DOCUMENT',
  
  // Other
  money: 'OTHER',
  black_money: 'OTHER',
  phone: 'OTHER',
  wallet: 'OTHER'
};

/**
 * Get category for item name
 */
const getCategory = (itemName) => {
  const lowerName = itemName.toLowerCase();
  
  // Check exact match first
  if (ITEM_CATEGORIES[lowerName]) {
    return ITEM_CATEGORIES[lowerName];
  }
  
  // Check partial matches
  if (lowerName.includes('weapon') || lowerName.includes('gun') || lowerName.includes('pistol')) {
    return 'WEAPON';
  }
  if (lowerName.includes('food') || lowerName.includes('burger') || lowerName.includes('pizza')) {
    return 'FOOD';
  }
  if (lowerName.includes('drink') || lowerName.includes('water') || lowerName.includes('soda')) {
    return 'DRINK';
  }
  if (lowerName.includes('med') || lowerName.includes('bandage') || lowerName.includes('health')) {
    return 'MEDICAL';
  }
  if (lowerName.includes('cloth') || lowerName.includes('outfit') || lowerName.includes('mask')) {
    return 'CLOTHING';
  }
  if (lowerName.includes('key')) {
    return 'KEY';
  }
  if (lowerName.includes('license') || lowerName.includes('card') || lowerName.includes('id')) {
    return 'DOCUMENT';
  }
  
  return 'ITEM';
};

/**
 * Sync player inventory
 */
const syncInventory = async (license, items) => {
  // Find player
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Delete existing inventory
  await prisma.playerInventoryItem.deleteMany({
    where: { playerId: player.id }
  });
  
  // Calculate total inventory value
  let totalValue = 0;
  
  // Create new inventory items
  if (items && items.length > 0) {
    const inventoryItems = items.map(item => ({
      playerId: player.id,
      name: item.name,
      label: item.label || item.name,
      count: item.count || 1,
      category: getCategory(item.name),
      metadata: item.metadata || {}
    }));
    
    await prisma.playerInventoryItem.createMany({
      data: inventoryItems
    });
    
    // Estimate value (in real scenario, you'd have item prices in DB)
    totalValue = items.reduce((sum, item) => {
      return sum + (item.count || 1) * getItemValue(item.name);
    }, 0);
  }
  
  // Update player stats with inventory value
  await prisma.playerStats.update({
    where: { playerId: player.id },
    data: {
      inventoryValue: totalValue,
      lastUpdated: new Date()
    }
  });
  
  // Get updated inventory
  const updatedInventory = await prisma.playerInventoryItem.findMany({
    where: { playerId: player.id },
    orderBy: [
      { category: 'asc' },
      { count: 'desc' }
    ]
  });
  
  // Emit WebSocket event
  if (global.io) {
    global.io.emit('player:inventory-updated', {
      playerId: player.id,
      inventory: updatedInventory,
      value: totalValue
    });
  }
  
  return {
    playerId: player.id,
    itemCount: updatedInventory.length,
    inventory: updatedInventory,
    totalValue
  };
};

/**
 * Get estimated value for item
 */
const getItemValue = (itemName) => {
  const values = {
    // Weapons
    weapon_pistol: 5000,
    weapon_revolver: 7500,
    weapon_smg: 15000,
    weapon_rifle: 25000,
    weapon_shotgun: 12000,
    weapon_sniper: 50000,
    weapon_knife: 500,
    
    // Vehicles (keys)
    carkey: 10000,
    
    // Phones
    phone: 1000,
    
    // Documents
    id_card: 100,
    driver_license: 500,
    weapon_license: 1000,
    
    // Default
    default: 100
  };
  
  const lowerName = itemName.toLowerCase();
  return values[lowerName] || values.default;
};

/**
 * Add item to inventory
 */
const addItem = async (license, item) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Check if item already exists
  const existingItem = await prisma.playerInventoryItem.findFirst({
    where: {
      playerId: player.id,
      name: item.name
    }
  });
  
  let inventoryItem;
  
  if (existingItem) {
    // Update count
    inventoryItem = await prisma.playerInventoryItem.update({
      where: { id: existingItem.id },
      data: {
        count: existingItem.count + (item.count || 1),
        updatedAt: new Date()
      }
    });
  } else {
    // Create new item
    inventoryItem = await prisma.playerInventoryItem.create({
      data: {
        playerId: player.id,
        name: item.name,
        label: item.label || item.name,
        count: item.count || 1,
        category: getCategory(item.name),
        metadata: item.metadata || {}
      }
    });
  }
  
  // Update inventory value
  await updateInventoryValue(player.id);
  
  // Emit WebSocket event
  if (global.io) {
    global.io.emit('player:item-added', {
      playerId: player.id,
      item: inventoryItem
    });
  }
  
  return inventoryItem;
};

/**
 * Remove item from inventory
 */
const removeItem = async (license, itemName, count = 1) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  const existingItem = await prisma.playerInventoryItem.findFirst({
    where: {
      playerId: player.id,
      name: itemName
    }
  });
  
  if (!existingItem) {
    throw new Error('Item not found in inventory');
  }
  
  let result;
  
  if (existingItem.count <= count) {
    // Delete item
    await prisma.playerInventoryItem.delete({
      where: { id: existingItem.id }
    });
    result = null;
  } else {
    // Update count
    result = await prisma.playerInventoryItem.update({
      where: { id: existingItem.id },
      data: {
        count: existingItem.count - count,
        updatedAt: new Date()
      }
    });
  }
  
  // Update inventory value
  await updateInventoryValue(player.id);
  
  // Emit WebSocket event
  if (global.io) {
    global.io.emit('player:item-removed', {
      playerId: player.id,
      itemName,
      remaining: result?.count || 0
    });
  }
  
  return result;
};

/**
 * Update inventory value
 */
const updateInventoryValue = async (playerId) => {
  const items = await prisma.playerInventoryItem.findMany({
    where: { playerId }
  });
  
  const totalValue = items.reduce((sum, item) => {
    return sum + (item.count * getItemValue(item.name));
  }, 0);
  
  await prisma.playerStats.update({
    where: { playerId },
    data: {
      inventoryValue: totalValue,
      lastUpdated: new Date()
    }
  });
  
  return totalValue;
};

/**
 * Get player inventory
 */
const getInventory = async (license) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  const items = await prisma.playerInventoryItem.findMany({
    where: { playerId: player.id },
    orderBy: [
      { category: 'asc' },
      { count: 'desc' }
    ]
  });
  
  // Group by category
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});
  
  return {
    playerId: player.id,
    playerName: player.playerName,
    items,
    grouped,
    itemCount: items.length,
    totalValue: items.reduce((sum, item) => sum + (item.count * getItemValue(item.name)), 0)
  };
};

/**
 * Get inventory by player ID
 */
const getInventoryById = async (playerId) => {
  const items = await prisma.playerInventoryItem.findMany({
    where: { playerId: parseInt(playerId) },
    orderBy: [
      { category: 'asc' },
      { count: 'desc' }
    ]
  });
  
  // Group by category
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});
  
  return {
    playerId: parseInt(playerId),
    items,
    grouped,
    itemCount: items.length,
    totalValue: items.reduce((sum, item) => sum + (item.count * getItemValue(item.name)), 0)
  };
};

/**
 * Wipe player inventory
 */
const wipeInventory = async (playerId) => {
  await prisma.playerInventoryItem.deleteMany({
    where: { playerId: parseInt(playerId) }
  });
  
  await prisma.playerStats.update({
    where: { playerId: parseInt(playerId) },
    data: {
      inventoryValue: 0,
      lastUpdated: new Date()
    }
  });
  
  // Emit WebSocket event
  if (global.io) {
    global.io.emit('player:inventory-wiped', {
      playerId: parseInt(playerId)
    });
  }
  
  return { success: true };
};

/**
 * Check for suspicious inventory
 */
const checkSuspiciousInventory = async (license) => {
  const player = await prisma.rPPlayer.findUnique({
    where: { license }
  });
  
  if (!player) {
    return { suspicious: false };
  }
  
  const items = await prisma.playerInventoryItem.findMany({
    where: { playerId: player.id }
  });
  
  const suspicious = [];
  
  // Check for inventory overflow
  if (items.length > 100) {
    suspicious.push({
      type: 'INVENTORY_OVERFLOW',
      message: `Player has ${items.length} unique items (normal max: 100)`,
      value: items.length
    });
  }
  
  // Check for excessive item counts
  items.forEach(item => {
    if (item.count > 100) {
      suspicious.push({
        type: 'EXCESSIVE_ITEM_COUNT',
        message: `Player has ${item.count}x ${item.label}`,
        value: item.count,
        item: item.name
      });
    }
  });
  
  // Check for suspicious item combinations
  const weaponCount = items.filter(i => i.category === 'WEAPON').length;
  if (weaponCount > 10) {
    suspicious.push({
      type: 'EXCESSIVE_WEAPONS',
      message: `Player has ${weaponCount} weapons`,
      value: weaponCount
    });
  }
  
  return {
    suspicious: suspicious.length > 0,
    issues: suspicious,
    player: {
      id: player.id,
      name: player.playerName
    }
  };
};

module.exports = {
  syncInventory,
  addItem,
  removeItem,
  getInventory,
  getInventoryById,
  wipeInventory,
  checkSuspiciousInventory,
  getCategory,
  getItemValue
};

