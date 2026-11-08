# Syano | Self-Hosted Open Source URL Shortener & Link Management

[![Docker Image Size](https://img.shields.io/docker/image-size/pritush/syano/latest?color=2496ED&logo=docker)](https://hub.docker.com/r/pritush/syano)
[![Docker Pulls](https://img.shields.io/docker/pulls/pritush/syano?color=blue&logo=docker)](https://hub.docker.com/r/pritush/syano)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://github.com/pritush/syano/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-pritush%2Fsyano-black?logo=github)](https://github.com/pritush/syano)

**[Syano](https://github.com/pritush/syano)** is a powerful self-hosted URL shortener and open source link management platform. Take complete control over your short links with advanced geographic and technology analytics, QR code generation, link-in-bio pages, TRAI India SMS compliance, and multi-user access control. A privacy-first alternative to Bitly, Dub, and TinyURL.

---

## ⚡ Quick Start with Docker Run

Run Syano connected to an existing PostgreSQL database:

```bash
docker run -d \
  --name syano \
  -p 3000:3000 \
  -e NUXT_DATABASE_URL="postgresql://username:password@db-host:5432/syano" \
  -e NUXT_SITE_TOKEN="your-secure-admin-token" \
  -e NUXT_SITE_USER="root" \
  -e NUXT_PUBLIC_SITE_URL="https://yourdomain.com" \
  -e ENCRYPTION_KEY="replace-with-a-secure-32-char-random-key" \
  --restart unless-stopped \
  pritush/syano:latest
```

Open your browser and visit:
- **Public URL**: `http://localhost:3000`
- **Admin Dashboard**: `http://localhost:3000/dashboard` *(log in using `NUXT_SITE_TOKEN`)*

---

## 🐳 Quick Start with Docker Compose (Recommended)

Save this `docker-compose.yml` file to run Syano alongside a PostgreSQL 16 database:

```yaml
services:
  app:
    image: pritush/syano:latest
    container_name: syano-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NUXT_DATABASE_URL=postgresql://postgres:postgres_secure_pass@db:5432/syano
      - NUXT_SITE_TOKEN=change_me_to_a_secure_token
      - NUXT_SITE_USER=root
      - NUXT_PUBLIC_SITE_URL=http://localhost:3000
      - ENCRYPTION_KEY=replace_with_a_secure_32_character_key_here
      - NUXT_REDIRECT_STATUS_CODE=301
      - NUXT_REDIRECT_WITH_QUERY=false
      - NUXT_CASE_SENSITIVE=false
      - NUXT_PUBLIC_SLUG_DEFAULT_LENGTH=4
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    container_name: syano-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres_secure_pass
      - POSTGRES_DB=syano
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d syano"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Launch the Stack:
```bash
docker compose up -d
```

### Initialize Database:
When using the official image with an empty PostgreSQL database:
1. Open **http://localhost:3000/dashboard**
2. Enter your `NUXT_SITE_TOKEN` to log in
3. Go to **Data Operations** and click **Initialize Database**
4. Done! All tables, indexes, and initial settings are created automatically.

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `NUXT_DATABASE_URL` | *Required* | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`) |
| `NUXT_SITE_TOKEN` | *Generated* | Master token used for logging in to `/dashboard` |
| `NUXT_SITE_USER` | `root` | Master admin username |
| `NUXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public production URL (used for QR code links and absolute redirects) |
| `ENCRYPTION_KEY` | *Required* | 32+ character random string used to encrypt stored API keys |
| `NUXT_REDIRECT_STATUS_CODE` | `301` | Default HTTP redirect status code (`301`, `302`, `307`) |
| `NUXT_REDIRECT_WITH_QUERY` | `false` | Whether to forward query parameters to destination URLs by default |
| `NUXT_CASE_SENSITIVE` | `false` | Whether short slugs are case-sensitive (`/abc` vs `/ABC`) |
| `NUXT_PUBLIC_SLUG_DEFAULT_LENGTH` | `4` | Character length for auto-generated short link slugs |
| `NUXT_CACHE_TTL` | `30` | Cache time-to-live in seconds for link redirects |
| `PORT` / `NITRO_PORT` | `3000` | Port the internal HTTP server binds to |
| `HOST` / `NITRO_HOST` | `0.0.0.0` | Host the internal HTTP server binds to |

---

## 🔒 Security Hardening

This image follows industry container best practices:
- **Non-root user**: The container runs under an unprivileged user (`syano:nodejs`, UID 1001).
- **Minimal attack surface**: Built on Alpine Linux with zero unnecessary packages.
- **Built-in Healthcheck**: Monitors `/api/health` with automated status reporting.
- **Stateless design**: All state is stored in PostgreSQL and Redis/cache, making it fully horizontally scalable.

---

## 🔄 Upgrades & Maintenance

To upgrade your container to the newest version of Syano:

```bash
docker compose pull
docker compose up -d
```

Once running, navigate to **Dashboard → Data Operations** to apply any pending database schema updates with 1 click.

---

## 📄 License & Source

- **License**: GNU Affero General Public License v3.0 ([AGPL-3.0](https://github.com/pritush/syano/blob/main/LICENSE))
- **Source Code**: [github.com/pritush/syano](https://github.com/pritush/syano)
- **Report Issues**: [github.com/pritush/syano/issues](https://github.com/pritush/syano/issues)
- **Author**: [Pritush](https://pritush.com.np)

