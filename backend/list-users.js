const prisma = require('./src/prismaClient');

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, role: true }
    });
    console.log('Users in database:');
    users.forEach(u => console.log(`  ${u.id}: ${u.username} (${u.email}) - ${u.role}`));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();

