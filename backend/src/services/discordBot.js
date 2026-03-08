/**
 * SpaceV - Discord Bot Service
 * ==========================
 * Handles Discord notifications for new purchases and site events.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const { Client, GatewayIntentBits, EmbedBuilder, WebhookClient } = require('discord.js');

let bot = null;
let webhookClient = null;

/**
 * Initialize Discord bot and webhook
 */
const initDiscordBot = async () => {
  // Initialize webhook client if URL is provided
  if (process.env.DISCORD_WEBHOOK_URL) {
    webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL });
    console.log('✅ Discord webhook client initialized');
  }

  // Initialize bot if token is provided
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN !== 'your_discord_bot_token') {
    try {
      bot = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ],
      });

      bot.on('ready', () => {
        console.log(`✅ Discord bot logged in as ${bot.user.tag}`);
      });

      bot.on('error', (error) => {
        console.error('Discord bot error:', error.message);
      });

      await bot.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
      console.warn('⚠️ Failed to initialize Discord bot:', error.message);
    }
  } else {
    console.log('⚠️ Discord bot not configured (no token provided)');
  }
};

/**
 * Send notification for new purchase
 */
const notifyNewPurchase = async (order) => {
  if (!webhookClient) {
    console.log('Discord webhook not configured, skipping notification');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6) // Violet color
    .setTitle('🛒 New Purchase!')
    .addFields(
      { name: 'Order ID', value: order.orderId || 'N/A', inline: true },
      { name: 'Customer', value: order.customerName || order.user?.username || 'Guest', inline: true },
      { name: 'Amount', value: `$${order.total}`, inline: true },
      { name: 'Items', value: order.items?.map(item => `${item.product?.name || 'Unknown'} x${item.quantity}`).join('\n') || 'N/A' },
    )
    .setTimestamp()
    .setFooter({ text: 'SpaceV Store' });

  try {
    await webhookClient.send({
      embeds: [embed],
    });
    console.log('📢 Discord purchase notification sent');
  } catch (error) {
    console.error('Failed to send Discord notification:', error.message);
  }
};

/**
 * Send notification for new user signup
 */
const notifyNewSignup = async (user) => {
  if (!webhookClient) return;

  const embed = new EmbedBuilder()
    .setColor(0x10b981) // Green color
    .setTitle('👤 New User Signup!')
    .addFields(
      { name: 'Username', value: user.username, inline: true },
      { name: 'Email', value: user.email, inline: true },
      { name: 'Method', value: user.discordId ? 'Discord' : 'Email', inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'SpaceV Store' });

  try {
    await webhookClient.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Failed to send signup notification:', error.message);
  }
};

/**
 * Send notification for refund
 */
const notifyRefund = async (order) => {
  if (!webhookClient) return;

  const embed = new EmbedBuilder()
    .setColor(0xef4444) // Red color
    .setTitle('💸 Refund Processed')
    .addFields(
      { name: 'Order ID', value: order.orderId, inline: true },
      { name: 'Amount', value: `$${order.total}`, inline: true },
      { name: 'Customer', value: order.customerEmail || 'N/A', inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'SpaceV Store' });

  try {
    await webhookClient.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Failed to send refund notification:', error.message);
  }
};

/**
 * Send site status update
 */
const notifySiteStatus = async (status, message) => {
  if (!webhookClient) return;

  const colors = {
    online: 0x10b981,
    offline: 0xef4444,
    maintenance: 0xf59e0b,
  };

  const embed = new EmbedBuilder()
    .setColor(colors[status] || 0x6b7280)
    .setTitle(`Site Status: ${status.toUpperCase()}`)
    .setDescription(message || `Site is now ${status}`)
    .setTimestamp()
    .setFooter({ text: 'SpaceV Monitor' });

  try {
    await webhookClient.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Failed to send status notification:', error.message);
  }
};

/**
 * Send message to specific channel (if bot is initialized)
 */
const sendToChannel = async (channelId, message) => {
  if (!bot) {
    console.log('Discord bot not initialized');
    return;
  }

  try {
    const channel = await bot.channels.fetch(channelId);
    if (channel) {
      await channel.send(message);
    }
  } catch (error) {
    console.error('Failed to send message to channel:', error.message);
  }
};

/**
 * Get bot instance
 */
const getBot = () => bot;

/**
 * Cleanup/disconnect bot
 */
const disconnectBot = async () => {
  if (bot) {
    await bot.destroy();
    bot = null;
  }
};

module.exports = {
  initDiscordBot,
  notifyNewPurchase,
  notifyNewSignup,
  notifyRefund,
  notifySiteStatus,
  sendToChannel,
  getBot,
  disconnectBot,
};

