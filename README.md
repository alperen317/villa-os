# Villa Management System

Modern, calendar-driven Property Management System (PMS) designed for small and medium-sized villa rental businesses.

The system supports renting an entire villa or individual floors while automatically preventing booking conflicts.

> **Project Status:** 🚧 In Development

---

## Overview

Villa Management System is a self-hosted web application that helps manage the daily operations of a villa rental business.

The application focuses on simplifying reservation management, customer tracking, payments, housekeeping, and maintenance through a clean and intuitive interface.

Unlike traditional hotel software, this system is designed specifically for businesses where a villa can be rented either as a whole or by individual floors.

---

## Core Features

- 🏡 Villa Management
- 🗓️ Calendar-based Reservation System
- 🏠 Floor-based Booking
- 👥 Customer Management
- 💳 Payment Tracking
- 🧹 Housekeeping Management
- 🔧 Maintenance Management
- 📊 Dashboard & Reports
- 🔐 Role-based Authentication

---

## Documentation

`docs/` is deliberately untracked (see `.gitignore`), so the files below live
only in a working copy that has them — a fresh clone will not contain them.
Code comments cite these documents by name for traceability.

| Document | Description |
|----------|-------------|
| [`PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Vision, goals and project scope |
| [`REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Business requirements and rules |
| [`DOMAIN.md`](docs/DOMAIN.md) | Domain model and business entities |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture |
| [`DATABASE.md`](docs/DATABASE.md) | Database design |
| [`API_GUIDELINES.md`](docs/API_GUIDELINES.md) | REST API conventions |
| [`CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) | Coding conventions and testing standards |
| [`ROADMAP.md`](docs/ROADMAP.md) | Development roadmap |
| [`FEATURES/`](docs/FEATURES/) | Per-module user flows, UI behavior, edge cases |

---

## Technology Stack

### Frontend
- Angular 22
- ng-zorro-antd
- Angular Signals
- RxJS
- FullCalendar

### Backend
- NestJS
- REST API
- JWT Authentication
- Swagger

### Database
- PostgreSQL
- Prisma ORM

### Infrastructure
- Docker
- Docker Compose
- Redis
- Nx (monorepo)

---

## Project Structure

```text
apps/
    web/            Angular front-end
    api/            NestJS API, Prisma schema and migrations
packages/           Shared libraries — reserved, no packages extracted yet
docker/             Compose file, Dockerfiles, nginx config
docs/               Design documents (untracked, see above)
```

---

## Running with Docker

Brings up PostgreSQL, Redis, the API and the web app. Requires Docker Desktop.

```bash
cp docker/.env.example docker/.env   # required: fill in the two JWT secrets
docker compose -f docker/docker-compose.yml up -d --build
```

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` have no defaults — compose refuses
to start until both are set, so that no deployment ends up signing tokens with
a value published in this repository. Generate each with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:8083 |
| API (through the web app) | http://localhost:8083/api/v1 |
| API (direct) | http://localhost:8084/api/v1 |
| Swagger | http://localhost:8084/api/docs |

Database migrations are applied automatically each time the API container
starts. The first user is created through the in-app onboarding screen.

```bash
docker compose -f docker/docker-compose.yml logs -f api   # follow API logs
docker compose -f docker/docker-compose.yml down          # stop, keep data
docker compose -f docker/docker-compose.yml down -v       # stop and wipe data
```

Ports can be changed via `WEB_PORT` / `API_PORT` in `docker/.env`. The browser
only ever talks to `WEB_PORT`: nginx proxies `/api` and `/uploads` to the API
container, so the app is same-origin and no port is baked into the built
bundle.

### Local development

Run the databases in containers and the apps on the host:

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

`docker/.env` is needed even for this: compose interpolates the whole file, so
the api service's required secrets are resolved no matter which services you
name on the command line.

The API reads `apps/api/.env` (see `apps/api/.env.example`). Note that Redis is
published on `REDIS_PORT` — `6380` by default, not `6379` — to avoid clashing
with a Redis already installed on the host. Apply migrations from `apps/api`,
where `prisma.config.ts` lives:

```bash
cd apps/api && npx prisma migrate deploy
```

`nx serve` is unaffected by the Docker ports. The API runs on `3333` and the
dev-server proxies `/api` and `/uploads` to it via `apps/web/proxy.conf.json`,
mirroring what nginx does in the container.

---

## Development Principles

- Domain-Driven Design (DDD)
- Modular Architecture
- SOLID Principles
- Clean Architecture
- RESTful API Design
- Type Safety
- Reusable Components

---

## Current Scope

This project is intended for a **single villa rental business** and is not designed as a SaaS platform.

The primary objective is to provide a reliable and maintainable solution for managing reservations and daily operations.

---

## License

This project is licensed under the MIT License.
