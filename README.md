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
    web/
    api/
packages/
    shared/
    ui/
docs/
docker/
scripts/
```

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
