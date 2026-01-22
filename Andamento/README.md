# Andamento API

Small HTTP API that replaces the previous webhook call and queries SQL Server.

## Setup
- Ensure the root `.env` has `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.
- Install dependencies: `npm install`

## Run
- `npm run start`
- Default port: `3001` (override with `PORT`)

## Endpoint
- `GET /api/get-andamento?startDate=YYYY-MM-DD&finalDate=YYYY-MM-DD`
- Header: `Authorization: Bearer <API_TOKEN>`
