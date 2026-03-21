# DataFactory Frontend

Data Agent training platform frontend, migrated from the main framework of `SpatialText2SQL-Frontend` and refocused to the Data Agent lifecycle.

## Core modules

- Data Preparation
- Reasoning Data Synthesis
- Agentic Trajectory Synthesis
- Agent Interaction
- User Login / Logout (preserved)

## Tech stack

- Vue 3 + Vite
- Vue Router
- Bootstrap 5 + Bootstrap Icons

## Development

```bash
npm install
npm run dev
```

Default dev server: `http://localhost:8001`

## Build

```bash
npm run build
npm run preview
```

## API proxy

`vite.config.js` proxies `/api` to `http://localhost:8888`.
