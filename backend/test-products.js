const prisma = require('./src/prismaClient');

async function test() {
  try {
    const featured = await prisma.product.findMany({ 
      where: { isFeatured: true, isActive: true },
      select: { id: true, name: true, isFeatured: true, isActive: true }
    });
    console.log('Featured products:', JSON.stringify(featured, null, 2));
    
    const all = await prisma.product.findMany({
      select: { id: true, name: true, isFeatured: true, isActive: true }
    });
    console.log('All products:', JSON.stringify(all, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();

