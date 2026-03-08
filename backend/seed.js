/**
 * SpaceV - Database Seed Script
 * Adds sample categories and products to the database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ==============================================
  // Create Categories
  // ==============================================
  const categories = [
    {
      name: 'Ranks',
      slug: 'ranks',
      description: 'VIP ranks with exclusive perks and privileges',
      image: '/images/ranks.png',
      sortOrder: 1,
      isActive: true,
    },
    {
      name: 'Items',
      slug: 'items',
      description: 'In-game items and cosmetics',
      image: '/images/items.png',
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'Bundles',
      slug: 'bundles',
      description: 'Package deals with multiple items',
      image: '/images/bundles.png',
      sortOrder: 3,
      isActive: true,
    },
    {
      name: 'Currency',
      slug: 'currency',
      description: 'Virtual currency for in-game purchases',
      image: '/images/currency.png',
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const category of categories) {
    const existing = await prisma.category.findUnique({
      where: { slug: category.slug },
    });

    if (!existing) {
      await prisma.category.create({ data: category });
      console.log(`✅ Created category: ${category.name}`);
    } else {
      console.log(`⏭️  Category already exists: ${category.name}`);
    }
  }

  // Get category IDs
  const ranksCat = await prisma.category.findUnique({ where: { slug: 'ranks' } });
  const itemsCat = await prisma.category.findUnique({ where: { slug: 'items' } });
  const bundlesCat = await prisma.category.findUnique({ where: { slug: 'bundles' } });
  const currencyCat = await prisma.category.findUnique({ where: { slug: 'currency' } });

  // ==============================================
  // Create Products
  // ==============================================
  const products = [
    // Ranks
    {
      name: 'VIP Rank',
      slug: 'vip-rank',
      description: 'Exclusive VIP rank with special perks including custom prefix, access to VIP chat, and more!',
      price: 9.99,
      image: '/images/ranks/vip.png',
      categoryId: ranksCat.id,
      type: 'RANK',
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
      TebexPackageId: 1001,
    },
    {
      name: 'VIP+ Rank',
      slug: 'vip-plus-rank',
      description: 'Enhanced VIP+ rank with even more perks including teleport commands and particle effects!',
      price: 19.99,
      image: '/images/ranks/vip-plus.png',
      categoryId: ranksCat.id,
      type: 'RANK',
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
      TebexPackageId: 1002,
    },
    {
      name: 'MVP Rank',
      slug: 'mvp-rank',
      description: 'Premium MVP rank with exclusive benefits, monthly rewards, and priority support!',
      price: 29.99,
      image: '/images/ranks/mvp.png',
      categoryId: ranksCat.id,
      type: 'RANK',
      isActive: true,
      isFeatured: true,
      sortOrder: 3,
      TebexPackageId: 1003,
    },
    {
      name: 'MVP++ Rank',
      slug: 'mvp-plus-plus-rank',
      description: 'The ultimate rank with all perks, custom cosmetics, and exclusive server access!',
      price: 49.99,
      image: '/images/ranks/mvp-plus-plus.png',
      categoryId: ranksCat.id,
      type: 'RANK',
      isActive: true,
      isFeatured: true,
      sortOrder: 4,
      TebexPackageId: 1004,
    },

    // Items
    {
      name: 'Diamond Sword',
      slug: 'diamond-sword',
      description: 'A powerful diamond sword with enhanced durability and damage.',
      price: 4.99,
      image: '/images/items/diamond-sword.png',
      categoryId: itemsCat.id,
      type: 'ITEM',
      isActive: true,
      isFeatured: false,
      sortOrder: 1,
      TebexPackageId: 2001,
    },
    {
      name: 'Ender Chest',
      slug: 'ender-chest',
      description: 'Portable Ender Chest that follows you anywhere.',
      price: 7.99,
      image: '/images/items/ender-chest.png',
      categoryId: itemsCat.id,
      type: 'ITEM',
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
      TebexPackageId: 2002,
    },
    {
      name: 'Golden Apple Pack',
      slug: 'golden-apple-pack',
      description: 'Pack of 64 golden apples for maximum healing.',
      price: 2.99,
      image: '/images/items/golden-apple.png',
      categoryId: itemsCat.id,
      type: 'ITEM',
      isActive: true,
      isFeatured: false,
      sortOrder: 3,
      TebexPackageId: 2003,
    },
    {
      name: 'XP Bottle Bundle',
      slug: 'xp-bottle-bundle',
      description: 'Bundle of experience bottles to level up fast!',
      price: 5.99,
      image: '/images/items/xp-bottle.png',
      categoryId: itemsCat.id,
      type: 'ITEM',
      isActive: true,
      isFeatured: false,
      sortOrder: 4,
      TebexPackageId: 2004,
    },

    // Bundles
    {
      name: 'Starter Pack',
      slug: 'starter-pack',
      description: 'Perfect for new players! Includes VIP rank for 30 days, 1000 coins, and starter kit.',
      price: 14.99,
      image: '/images/bundles/starter.png',
      categoryId: bundlesCat.id,
      type: 'BUNDLE',
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
      TebexPackageId: 3001,
    },
    {
      name: 'Pro Player Bundle',
      slug: 'pro-player-bundle',
      description: 'Everything you need! VIP+ rank for 60 days, 5000 coins, exclusive cosmetics, and pro kit.',
      price: 39.99,
      image: '/images/bundles/pro.png',
      categoryId: bundlesCat.id,
      type: 'BUNDLE',
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
      TebexPackageId: 3002,
    },
    {
      name: 'Ultimate Bundle',
      slug: 'ultimate-bundle',
      description: 'The ultimate experience! MVP++ rank for 90 days, unlimited coins, all cosmetics, and more!',
      price: 79.99,
      image: '/images/bundles/ultimate.png',
      categoryId: bundlesCat.id,
      type: 'BUNDLE',
      isActive: true,
      isFeatured: true,
      sortOrder: 3,
      TebexPackageId: 3003,
    },

    // Currency
    {
      name: '100 Coins',
      slug: 'coins-100',
      description: '100 in-game coins for purchases in the store.',
      price: 0.99,
      image: '/images/currency/coins-100.png',
      categoryId: currencyCat.id,
      type: 'CURRENCY',
      isActive: true,
      isFeatured: false,
      sortOrder: 1,
      TebexPackageId: 4001,
    },
    {
      name: '500 Coins',
      slug: 'coins-500',
      description: '500 in-game coins - save 10% compared to buying individually!',
      price: 4.49,
      image: '/images/currency/coins-500.png',
      categoryId: currencyCat.id,
      type: 'CURRENCY',
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
      TebexPackageId: 4002,
    },
    {
      name: '1000 Coins',
      slug: 'coins-1000',
      description: '1000 in-game coins - save 20%! Great value pack.',
      price: 7.99,
      image: '/images/currency/coins-1000.png',
      categoryId: currencyCat.id,
      type: 'CURRENCY',
      isActive: true,
      isFeatured: true,
      sortOrder: 3,
      TebexPackageId: 4003,
    },
    {
      name: '5000 Coins',
      slug: 'coins-5000',
      description: '5000 in-game coins - massive savings! Best value pack.',
      price: 34.99,
      image: '/images/currency/coins-5000.png',
      categoryId: currencyCat.id,
      type: 'CURRENCY',
      isActive: true,
      isFeatured: true,
      sortOrder: 4,
      TebexPackageId: 4004,
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });

    if (!existing) {
      await prisma.product.create({ data: product });
      console.log(`✅ Created product: ${product.name}`);
    } else {
      console.log(`⏭️  Product already exists: ${product.name}`);
    }
  }

  console.log('\n🎉 Database seeding completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

