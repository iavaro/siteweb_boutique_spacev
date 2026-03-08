# ==============================================
# SpaceV SaaS Website
# ==============================================
A complete professional SpaceV SaaS website with Node.js + Express backend and vanilla HTML/CSS/JS frontend.

## Features

- 🌟 Neon cyberpunk design with violet/neon accents
- 🛒 Product catalog with categories and filtering
- 🛒️ Shopping cart with Tebex integration
- 👤 User authentication (Email + Discord OAuth)
- 📊 User Dashboard with order history
- ⚙️ Admin Panel with user, product, and order management
- 📄 Automatic PDF invoice generation
- 📧 Email notifications (registration, purchases, invoices)
- 💬 Discord bot notifications for new purchases
- 📈 Analytics dashboard

## Prerequisites

- Node.js (v18+)
- XAMPP with MySQL (or any MySQL server)
- Tebex store account (for payments)

## Installation

1. **Install Node.js dependencies**
```bash
cd backend
npm install
```

2. **Set up MySQL Database**
- Start XAMPP MySQL
- Create a database named `tebx`
- Update `.env` with your database credentials

3. **Generate Prisma Client**
```bash
cd backend
npx prisma generate
```

4. **Push database schema**
```bash
npx prisma db push
```

5. **Configure Environment Variables**

Copy `.env.example` to `.env` and fill in your values:

```env
# Database
DATABASE_URL="mysql://root:@127.0.0.1:3306/tebx"

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=SpaceV <noreply@spacev.store>

# Tebex
TEBEX_STORE_URL=https://your-store.tebex.io
TEBEX_API_SECRET=your_tebex_api_secret
TEBEX_WEBHOOK_SECRET=your_webhook_secret

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id
DISCORD_WEBHOOK_URL=your_webhook_url

# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Site
SITE_URL=http://localhost:3000
SITE_NAME=SpaceV
```

6. **Start the Server**
```bash
npm start
```

Visit `http://localhost:3000`

## Tebex Webhook Setup

1. Go to your Tebex dashboard
2. Navigate to Settings > Webhooks
3. Add new webhook:
   - URL: `http://your-domain.com/api/webhooks/tebex`
   - Events: payment, payment_refund, payment_failed
4. Copy the webhook secret to your `.env`

## Discord Bot Setup

1. Create a bot at https://discord.com/developers/applications
2. Enable Intent: GUILD_MESSAGES
3. Get the bot token and add to `.env`
4. Create a Discord channel for purchase notifications
5. Get the channel ID and webhook URL

## Project Structure

```
spacev/
├── backend/
│   ├── src/
│   │   ├── index.js           # Main server
│   │   ├── prismaClient.js   # Database client
│   │   ├── routes/           # API routes
│   │   ├── middlewares/      # Auth, error handling
│   │   ├── services/         # Discord, Tebex services
│   │   └── utils/            # Helpers, email, invoices
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── package.json
│   └── .env
├── frontend/                   # HTML pages
├── public/
│   ├── styles.css            # Global styles
│   └── scripts.js            # Frontend JS
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/discord` - Discord OAuth
- `POST /api/auth/forgot-password` - Password reset

### Products
- `GET /api/products` - List products
- `GET /api/products/featured` - Featured products
- `GET /api/products/categories` - List categories
- `GET /api/products/:slug` - Get product

### Orders
- `GET /api/orders/cart` - Get cart
- `POST /api/orders/cart` - Add to cart
- `POST /api/orders/checkout` - Create checkout
- `GET /api/orders` - Get user orders

### Users
- `GET /api/users/me` - Get profile
- `PUT /api/users/me` - Update profile
- `GET /api/users/notifications` - Get notifications

### Admin (requires auth)
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - Manage users
- `GET /api/admin/orders` - Manage orders
- `GET /api/admin/analytics` - View analytics

## Support

- Discord: https://discord.gg/spacev
- Email: support@spacev.store

## License

MIT

"# siteweb_boutique_spacev" 
"# siteweb_spacev_complet" 
