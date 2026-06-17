# Client System

A Next.js client/archive management system for dashboard workflows, customer records, document handling, and data integrations.

## Status

Public pinned candidate.

## Key Features

- Next.js App Router project structure
- Client/dashboard management workflow foundation
- Form validation with React Hook Form and Zod
- MongoDB and Mongoose integration support
- MSSQL integration support for external data sources
- JWT/Jose authentication package foundation
- ZIP/document workflow support with JSZip
- Tailwind CSS styling setup

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- MongoDB / Mongoose
- MSSQL
- React Hook Form
- Zod
- JWT / Jose
- Axios

## Getting Started

```bash
git clone https://github.com/yousefm2311/client-system.git
cd client-system
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Environment Variables

Create a local `.env.local` file when connecting to real services.

```env
DATABASE_URL=
MONGODB_URI=
MSSQL_CONNECTION_STRING=
JWT_SECRET=
NEXT_PUBLIC_API_URL=
```

Never commit real credentials, database URLs, customer data, or production secrets.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Screenshots

Add dashboard and client workflow screenshots before pinning publicly.

```md
![Client dashboard](docs/screenshots/dashboard.png)
```

## Author

Yousef Mohamed

- GitHub: https://github.com/yousefm2311
