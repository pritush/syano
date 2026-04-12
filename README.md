# Syano - Free Open-Source URL Shortener

<div align="center">

![Syano Logo](https://raw.githubusercontent.com/free-whiteboard-online/Free-Erasorio-Alternative-for-Collaborative-Design/ae5d11ccf2a3ed0620ec288ecc6d8a1ac14f3be1/uploads/2026-04-12T11-34-35-368Z-fx4qdk2mo.png)

**A powerful, self-hosted URL shortener with analytics and link-in-bio pages. The free Bitly alternative.**

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D14-blue.svg)](https://www.postgresql.org)
[![Nuxt](https://img.shields.io/badge/nuxt-3.x-00DC82.svg)](https://nuxt.com)

[Features](#-features) • [Quick Start](#-quick-start) • [Deploy](#-deployment) • [Docs](#-documentation)

</div>

---

## 🌟 Why Syano?

Syano is a free, open-source URL shortener that gives you complete control over your links and data. Unlike Bitly, your data stays on your server with no tracking or limitations.

- 🔒 **Privacy First** - Your data stays on your server
- 🚀 **Fast & Reliable** - Optimized for performance
- 🎨 **Beautiful UI** - Modern design with dark mode
- 📊 **Analytics** - Track clicks, geography, and referrers
- 🔧 **Easy Setup** - Deploy in minutes
- 💰 **Free & Opensource** - AGPL-3.0 licensed

---

## ✨ Features

### Core Features
- **Custom Short Links** - Create memorable URLs with custom slugs
- **Link Organization** - Organize with tags and comments
- **Search & Filter** - Find links quickly
- **Link Expiration** - Set automatic expiration dates
- **Password Protection** - Secure sensitive links
- **Device Targeting** - Different URLs for iOS/Android
- **Bulk Import/Export** - Import thousands of links from JSON

### Analytics & Tracking
- **Real-time Analytics** - Track clicks as they happen
- **Geographic Data** - Interactive world map with country/city data
- **Device Insights** - OS, browser, and device breakdown
- **Referrer Tracking** - See where traffic comes from

### Link-in-Bio
- **Beautiful Bio Pages** - Customizable link-in-bio like Linktree
- **Profile Customization** - Name, bio, avatar, and social links
- **Multiple Links** - Add unlimited links with icons and colors
- **Share Profile** - One-click sharing


---

## Screenshots
![Syano screenshot](https://raw.githubusercontent.com/free-whiteboard-online/Free-Erasorio-Alternative-for-Collaborative-Design/fcc6b6fcde2624a3cc5d80c0b25325b554c349a4/uploads/2026-04-12T11-39-00-437Z-06pwoe4r7.jpg)

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** 14+
- **pnpm** or npm

### 1. Clone & Install

```bash
git clone https://github.com/pritush/syano.git
cd syano
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
NUXT_DATABASE_URL=postgresql://user:password@host:5432/database
NUXT_SITE_TOKEN=your-secure-random-token
NUXT_SITE_USER=root
```

### 3. Set Up Database

```bash
# Create database
createdb syano

# Import schema
psql -d syano -f database/schema.sql
```

### 4. Start Development

```bash
pnpm dev
```

Visit **http://localhost:7466** and login with your token.

---

## 📦 Database Setup

### Supported Databases
- ✅ **Local** - PostgreSQL, Node, Docker
- ✅ **Supabase** - Serverless PostgreSQL
- ✅ **Neon** - Serverless PostgreSQL
- ✅ **Aiven** - Serverless  PostgreSQL
- ✅ **Self-hosted** - Any PostgreSQL instance

### Using Docker

```bash
docker run -d \
  --name syano-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=syano \
  -p 5432:5432 \
  postgres:14

docker exec -i syano-db psql -U postgres -d syano < database/schema.sql
```

---

## 🚀 Deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/pritush/syano)

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod
```

### Self-Hosted
Deploy on any server with Node.js and PostgreSQL support.

---

## 🛠️ Tech Stack

- **[Nuxt 3](https://nuxt.com)** - Vue.js framework
- **[Nuxt UI](https://ui.nuxt.com)** - UI components
- **[Tailwind CSS](https://tailwindcss.com)** - Styling
- **[PostgreSQL](https://www.postgresql.org)** - Database
- **[Drizzle ORM](https://orm.drizzle.team)** - Type-safe ORM

---

## 📖 Documentation

See [database/schema.sql](database/schema.sql) for the complete database schema. You can run the SQL queries in your postgres database (cloud or hosted) to create tables.

### Environment Variables

```env
# Required
NUXT_DATABASE_URL=postgresql://user:pass@host:5432/database
NUXT_SITE_TOKEN=your-secure-random-token
NUXT_SITE_USER=admin

# Optional
NUXT_CACHE_TTL=30
NUXT_REDIRECT_STATUS_CODE=301
NUXT_PUBLIC_SLUG_DEFAULT_LENGTH=6
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## 📄 License

This project is licensed under the **AGPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ by [Pritush](https://pritush.com.np)

[GitHub](https://github.com/pritush/syano) • [Twitter](https://twitter.com/pri2sh)

</div>
