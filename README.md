# Pastebin Web Application

A lightweight, secure Pastebin-like application built with React, Node.js (Express), and Neon Postgres.

## Features

- **Text Storage**: Quickly store and share text snippets.
- **Constraints**: 
  - **TTL (Time-To-Live)**: Optional time-based expiry in seconds.
  - **Max Views**: Optional limit on the number of times a paste can be viewed.
- **Deterministic Time Scaling**: Support for `x-test-now-ms` header for testing expiry logic.
- **Modern UI**: Built with React and Tailwind CSS for a premium experience.
- **Secure**: Basic HTML escaping for XSS protection and stateless backend.

## Tech Stack

- **Frontend**: React (Vite, Tailwind CSS, Framer Motion, Lucide)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Neon) interaction using raw SQL.
- **Deployment**: Vercel

## Local Setup

### Prerequisites

- Node.js (v18+)
- A Neon Postgres Database (or any Postgres instance)

### Environment Variables

Create a `.env` file in the `backend/` directory with the following:

```env
DATABASE_URL=your_postgres_url
PORT=3000
TEST_MODE=0
BASE_URL=http://localhost:3000
```

### Backend Installation

```bash
cd backend
npm install
node index.js
```

### Frontend Installation

```bash
cd frontend
npm install
npm run dev
```

## Persistence Layer

The application uses a Neon Postgres database. The schema consists of a single `pastes` table:

```sql
CREATE TABLE pastes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

Persistence is managed via the `@neondatabase/serverless` driver using raw SQL queries for maximum performance and control.

## Design Decisions

1. **Separation of Concerns**: Separate `frontend` and `backend` directories allow for independent scaling and clearer project structure.
2. **Server-Side Expiry Logic**: All validation and expiry checks are handled on the server to ensure security and consistency.
3. **Atomic View Increments**: View counts are incremented directly in the SQL update query to prevent race conditions in a serverless environment.
4. **Tailwind CDN for View Page**: To ensure the `GET /p/:id` route returns a self-contained, fast-loading HTML page as required by automated tests, it uses Tailwind via CDN while the main app is a full React build.
5. **Deterministic Testing**: Implemented a helper for time retrieval that respects the `x-test-now-ms` header if `TEST_MODE` is enabled.
