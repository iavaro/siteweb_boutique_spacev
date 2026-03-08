const prisma = require('./src/prismaClient');

async function setAdmin() {
  // Replace with the email of the user you want to make admin
  const email = process.argv[2] || 'admin@spacev.com';
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, username: true, role: true }
    });
    console.log(`✅ User ${user.email} is now: ${user.role}`);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.log('Usage: node set-admin.js <email>');
  } finally {
    await prisma.$disconnect();
  }
}

setAdmin();

