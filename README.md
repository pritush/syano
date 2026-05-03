# Syano - Self-Hosted URL Shortener | Open Source Link Management Platform

<div align="center">

![Syano - Open Source URL Shortener](https://raw.githubusercontent.com/free-whiteboard-online/Free-Erasorio-Alternative-for-Collaborative-Design/ae5d11ccf2a3ed0620ec288ecc6d8a1ac14f3be1/uploads/2026-04-12T11-34-35-368Z-fx4qdk2mo.png)

**Syano is a powerful self-hosted URL shortener and open source link management platform, ready for enterprise implementation. Take complete control of your short links with advanced analytics, QR codes, link-in-bio pages, and enterprise-grade features. The best Bitly alternative for privacy-conscious teams.**

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D14-blue.svg)](https://www.postgresql.org)
[![Nuxt 3](https://img.shields.io/badge/nuxt-3.x-00DC82.svg)](https://nuxt.com)
[![Docker Ready](https://img.shields.io/badge/docker-ready-2496ED.svg)](https://www.docker.com)

[Features](#-features) • [Quick Start](#-quick-start) • [Deploy](#-deployment-options) • [Documentation](#-documentation) • [Demo](#-live-demo)

<a href="https://www.producthunt.com/products/syano-opensource-url-shortener" target="_blank"><img alt="Syano - Open Source URL Shortener | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1121910&theme=light"></a>

</div>

---

## 🌟 Why Choose Syano as Your Self-Hosted URL Shortener?

Most URL shorteners lock you into their ecosystem — your links, your data, and your analytics are controlled by someone else. **Syano is different.** As a fully open source URL shortener, you own everything.

Deploy in serverless or VPS infrastructure. Visit /dashboard to login and manage your links. Set login and settings from .env file.


### The Problem with Cloud URL Shorteners
- 🚫 Your links can disappear if the service shuts down
- 🚫 Analytics data is sold to third parties
- 🚫 Pricing changes can break your budget
- 🚫 Limited customization and branding
- 🚫 No control over uptime and performance

### The Syano Solution: Self-Hosted URL Shortener
- ✅ **Complete Data Ownership** - Your links, your server, your rules
- ✅ **Privacy-First Architecture** - No tracking, no data selling
- ✅ **Zero Recurring Costs** - One-time setup, unlimited links forever
- ✅ **Enterprise Features** - Multi-user access, audit logs, advanced analytics
- ✅ **Deploy Anywhere** - Vercel, Netlify, Docker, VPS, or your own infrastructure
- ✅ **Open Source Forever** - AGPL-3.0 licensed, community-driven development

---
## 🖼️ Screenshots

![Syano Dashboard - Self-Hosted URL Shortener](https://raw.githubusercontent.com/pritush/syano/refs/heads/main/public/ghimg.jpg)

---

## ✨ Complete Feature Set

Syano isn't just a URL shortener — it's a comprehensive link management platform designed for teams, marketers, and developers who need professional-grade tools without the SaaS price tag.

### 🔗 Advanced Link Management

**Smart URL Shortening**
- Custom slugs or auto-generated short links
- Live preview before saving
- Bulk import/export (JSON format)
- Real-time search across all link metadata
- Tag-based organization and filtering

**Marketing & Campaign Tools**
- Built-in UTM parameter builder
- Link expiration scheduling
- Password-protected links
- Device-specific targeting (iOS/Android)
- Link cloaking with iframe embedding
- Custom redirect status codes (301/302/307)

**Link Organization**
- Hierarchical tag system
- Internal comments and notes
- Advanced search and filtering
- Sort by clicks, date, or custom criteria
- Batch import

### 📊 Professional Analytics Dashboard

**Analytics**
- Analytics for each link
- 24-hour and 7-day trend analysis and customer date range
- Export analytics data (CSV/JSON)

**Geographic Intelligence**
- Country, region, and city-level tracking
- Interactive world map visualization
- QR Scan Analytics
- Acquisition

**Technology Analytics**
- Browser and browser version tracking
- Operating system detection
- Device type classification (mobile/tablet/desktop)

**Marketing Attribution**
- Full UTM parameter tracking
- Referrer source analysis
- Acquisition channel breakdown

**Analytics**
- Activity heatmap (day × hour)
- Peak traffic time identification
- Click pattern analysis
- Recent events feed with real-time updates
- QR code scan tracking (separate from web clicks)

### 🎨 QR Code Generator

**Professional QR Codes**
- Instant QR code generation for every link
- SVG format (scalable, print-ready)
- PNG export for digital use
- Server-side rendering with 7-day caching
- Automatic QR scan tracking

**Use Cases**
- Print marketing materials
- Event tickets and badges
- Product packaging
- Restaurant menus
- Business cards

### 🌐 Link-in-Bio Pages

**Personal Landing Pages**
- Customizable bio page on your home page
- Profile photo and initials
- Bio text and description
- Unlimited custom links
- Social media icon row (20+ platforms)

**Link Customization**
- Custom titles and subtitles
- Icon selection from curated library
- Color accent customization
- Drag-and-drop reordering
- Show/hide individual links

**Homepage Modes**
- Default Syano landing page
- Custom redirect with delay
- Link-in-bio page
- Instant switching via dashboard

### 👥 Multi-User & Team Management

**User Access Control**
- Unlimited dashboard users
- Individual user accounts with secure authentication
- Enable/disable users without deletion
- User activity tracking in audit logs

**Granular Permission System**
- 4 preset roles: Viewer, Editor, Manager, Admin
- 10+ individual permissions
- Custom permission combinations
- Role-based access control (RBAC)
- Permission inheritance


### 🔌 REST API 

**Programmatic Access**
- Full REST API for link management
- API key authentication with granular permissions
- OpenAPI-compatible endpoints
- Modern API documentation and API playground using Scalar

**API Features**
- Create, read, update, delete links
- Bulk link creation 
- Analytics data export
- Tag management
- Search across links


**Integration Examples**
- Zapier workflows
- Make.com (Integromat) scenarios
- n8n automation
- Custom applications
- CI/CD pipelines
- Slack/Discord notifications



### ⚡ Performance & Infrastructure


**Supported Databases:**
- PostgreSQL (local or self-hosted)
- Neon (serverless PostgreSQL)
- Supabase (PostgreSQL as a service)
- Aiven (managed PostgreSQL)
- AWS RDS, Google Cloud SQL, Azure Database
- Docker PostgreSQL containers

### 🎨 User Experience

**Modern Interface**
- Clean, intuitive dashboard
- Full dark mode support
- Responsive design (mobile, tablet, desktop)
- Real-time updates

**Developer Experience**
- TypeScript throughout
- Type-safe database queries (Drizzle ORM)
- Comprehensive API documentation
- Easy local & cloud setup
- One click database update
- Easy database migration from dashboard

---

## 🚀 Quick Start Guide

Get your self-hosted URL shortener running in under 5 minutes.

### Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **pnpm** (recommended)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/pritush/syano.git
cd syano
pnpm install
```

#### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Connection
# For serverless (Netlify/Vercel): Use Neon pooled connection
DATABASE_URL=postgresql://user:pass@project-pooler.neon.tech/db?sslmode=require

# For traditional servers (VPS/Docker): Use direct connection
# DATABASE_URL=postgresql://user:pass@localhost:5432/syano

# Authentication (for login /dashboard)
NUXT_SITE_TOKEN=your-secure-random-token-here
NUXT_SITE_USER=root

# Optional: Connection Pool Tuning
# DB_POOL_MAX=20
# DB_POOL_MIN=2

# Optional: Application Settings
# NUXT_CACHE_TTL=30
# NUXT_REDIRECT_STATUS_CODE=301
# NUXT_PUBLIC_SLUG_DEFAULT_LENGTH=6
```

#### 3. Set Up Database

**Option A: Local PostgreSQL**
```bash
createdb syano
psql -d syano -f database/schema.sql
```

**Option B: Docker PostgreSQL**
```bash
docker run -d \
  --name syano-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=syano \
  -p 5432:5432 \
  postgres:16-alpine

docker exec -i syano-db psql -U postgres -d syano < database/schema.sql
```

**Option C: Cloud Database (Neon, Supabase)**
```bash
# Copy the SQL from database/schema.sql and run it in your cloud database console
# Or use psql with your cloud connection string
psql -d "your-cloud-connection-string" -f database/schema.sql
```

**Verify Database Setup:**
```bash
pnpm run db:check-audit
```

#### 4. Start Development Server

```bash
pnpm dev
```

Visit **http://localhost:7466** and login with your `NUXT_SITE_TOKEN`.

---

## 🌐 Deployment Options

Deploy your self-hosted URL shortener to any platform in minutes.

### Serverless Platforms (Recommended)

#### Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
pnpm run build
netlify deploy --prod
```

**Environment Variables:**
- `DATABASE_URL` - Use Neon pooled connection (`-pooler` suffix)
- `NUXT_SITE_TOKEN` - Your secure token
- `NUXT_SITE_USER` - Admin username (default: root)

#### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/pritush/syano)


## 🎯 Use Cases

### For Marketers
- Track campaign performance with UTM parameters
- A/B test different landing pages
- Monitor geographic reach
- Analyze device and browser trends
- Generate QR codes for offline campaigns

### For Developers
- Self-hosted alternative to Bitly, TinyURL, Short.io
- REST API for programmatic link creation
- Webhook integrations with Zapier, Make.com, n8n
- Custom domain support
- White-label solution
- CI/CD pipeline integration
- Automated link generation from deployments

### For Teams
- Multi-user access with role-based permissions
- Audit logs for compliance
- Centralized link management
- Team collaboration features
- Secure password-protected links

### For Content Creators
- Link-in-bio pages for social media
- Track audience engagement
- Organize links by campaign or topic
- Professional QR codes for merchandise
- Analytics for content performance

---

## 🛠️ Technology Stack

**Frontend:**
- [Nuxt 3](https://nuxt.com) - Vue.js meta-framework
- [Nuxt UI](https://ui.nuxt.com) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
- [Chart.js](https://www.chartjs.org) - Analytics visualizations
- [D3.js](https://d3js.org) - Geographic data visualization
- [Scalar](https://scalar.com) - API documentation and API playground

**Backend:**
- [Node.js](https://nodejs.org) - JavaScript runtime
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database queries
- [PostgreSQL](https://www.postgresql.org) - Relational database



---

## 🔒 Security & Privacy

### Data Privacy
- **No Third-Party Tracking** - Your data never leaves your server
- **No Analytics Selling** - Your insights remain private
- **Self-Hosted** - Complete data sovereignty


## 📊 Live Demo

Experience Syano in action:

**Demo Instance:** [https://syano.vercel.app](https://syano.vercel.app)

**Test Links:**
- https://syano.vercel.app/gmap
- https://syano.vercel.app/smo5r
- https://syano.vercel.app/jubfz
- https://syano.vercel.app/klcvx

---


### Reporting Issues
Found a bug or have a feature request? [Open an issue](https://github.com/pritush/syano/issues) on GitHub.

---

## 📄 License

Syano is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- ✅ Free to use, modify, and distribute
- ✅ Open source forever
- ✅ Commercial use allowed
- ⚠️ Must disclose source code if you modify and deploy

See the [LICENSE](LICENSE) file for full details.


### Alternatives Comparison
Syano vs. other URL shorteners:
- **vs. Bitly** - Self-hosted, no monthly fees, unlimited links
- **vs. TinyURL** - Advanced analytics, team management, audit logs
- **vs. Short.io** - Open source, full data ownership, no vendor lock-in
- **vs. Rebrandly** - Free forever, customizable, privacy-first

---

## 💡 Frequently Asked Questions

### Is Syano really free?
Yes! Syano is 100% free and open source under the AGPL-3.0 license. No hidden costs, no premium tiers, no feature limitations.

### Can I use my own domain?
Absolutely! Deploy Syano on any domain you own. Perfect for branded short links like `yourbrand.link/promo`.

### How many links can I create?
Unlimited. There are no artificial limits on links, clicks, or users.

### Is it suitable for production use?
Yes! Syano is production-ready with features like connection pooling, caching, health checks, and audit logging.

### Can I migrate from Bitly or other services?
Yes! Use the bulk import feature to migrate your existing links. Export from your current service and import into Syano.

### What about performance at scale?
Syano is optimized for performance with database indexing, connection pooling, and caching. It handles thousands of redirects per second on modest hardware.

### Do I need coding knowledge?
Basic command-line knowledge is helpful for deployment, but the dashboard is user-friendly and requires no coding.

### Can I customize the look and feel?
Yes! Syano is fully customizable. Modify the source code, add your branding, or contribute themes back to the community.

---


Project by [Pritush](https://pritush.com.np)



<div align="center">

**⭐ Star us on GitHub if you find Syano useful!**

**Self-Hosted URL Shortener • Open Source Link Management • Privacy-First Analytics**

[Get Started](#-quick-start-guide) • [View Demo](https://syano.netlify.app) • [Read Docs](docs/)

Made with ❤️ for the open source community

</div>
