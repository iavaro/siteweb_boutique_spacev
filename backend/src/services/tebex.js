/**
 * SpaceV - Tebex Service
 * ======================
 * Handles Tebex API interactions and webhook setup.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const axios = require('axios');

const TEBEX_API_BASE = 'https://api.tebex.io/api';

/**
 * Initialize Tebex webhook endpoint on the Express app
 */
const initTebexWebhook = async (app) => {
  // Tebex webhooks are handled via the /api/webhooks/tebex route
  console.log('✅ Tebex webhook route registered at /api/webhooks/tebex');
};

/**
 * Get Tebex store information
 */
const getStoreInfo = async () => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.get(`${TEBEX_API_BASE}/account`, {
      headers: {
        'Authorization': process.env.TEBEX_API_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get Tebex store info:', error.message);
    return null;
  }
};

/**
 * Get all packages/categories from Tebex
 */
const getPackages = async () => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.get(`${TEBEX_API_BASE}/packages`, {
      headers: {
        'Authorization': process.env.TEBEX_API_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get Tebex packages:', error.message);
    return null;
  }
};

/**
 * Get categories from Tebex
 */
const getCategories = async () => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.get(`${TEBEX_API_BASE}/categories`, {
      headers: {
        'Authorization': process.env.TEBEX_API_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get Tebex categories:', error.message);
    return null;
  }
};

/**
 * Get orders from Tebex
 */
const getOrders = async (page = 1, limit = 50) => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.get(`${TEBEX_API_BASE}/orders`, {
      params: { page, limit },
      headers: {
        'Authorization': process.env.TEBEX_API_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get Tebex orders:', error.message);
    return null;
  }
};

/**
 * Get single order from Tebex
 */
const getOrder = async (orderId) => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.get(`${TEBEX_API_BASE}/orders/${orderId}`, {
      headers: {
        'Authorization': process.env.TEBEX_API_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get Tebex order:', error.message);
    return null;
  }
};

/**
 * Create checkout link (embedded checkout)
 */
const createCheckout = async (packages) => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.post(
      `${TEBEX_API_BASE}/checkout/create`,
      { packages },
      {
        headers: {
          'Authorization': process.env.TEBEX_API_SECRET,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to create Tebex checkout:', error.message);
    return null;
  }
};

/**
 * Get gift card balance
 */
const getGiftCard = async (code) => {
  if (!process.env.TEBEX_API_SECRET || process.env.TEBEX_API_SECRET === 'your_tebex_api_secret') {
    return null;
  }

  try {
    const response = await axios.get(`${TEBEX_API_BASE}/gift-cards/${code}`, {
      headers: {
        'Authorization': process.env.TEBEX_API_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get gift card:', error.message);
    return null;
  }
};

/**
 * Sync products from Tebex to local database
 */
const syncProducts = async (prisma) => {
  const categories = await getCategories();
  const packages = await getPackages();

  if (!categories || !packages) {
    console.warn('Could not fetch Tebex data for sync');
    return;
  }

  // Sync categories
  for (const cat of categories.data || []) {
    await prisma.category.upsert({
      where: { slug: cat.id.toString() },
      update: {
        name: cat.name,
        description: cat.description,
      },
      create: {
        name: cat.name,
        slug: cat.id.toString(),
        description: cat.description,
        TebexCategoryId: cat.id,
      },
    });
  }

  // Sync packages
  for (const pkg of packages.data || []) {
    await prisma.product.upsert({
      where: { slug: pkg.id.toString() },
      update: {
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        image: pkg.image,
        TebexPackageId: pkg.id,
      },
      create: {
        name: pkg.name,
        slug: pkg.id.toString(),
        description: pkg.description,
        price: pkg.price,
        image: pkg.image,
        TebexPackageId: pkg.id,
        type: 'ITEM',
      },
    });
  }

  console.log('✅ Products synced from Tebex');
};

module.exports = {
  initTebexWebhook,
  getStoreInfo,
  getPackages,
  getCategories,
  getOrders,
  getOrder,
  createCheckout,
  getGiftCard,
  syncProducts,
};

