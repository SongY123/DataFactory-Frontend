# DataFactory Frontend

Data Agent training platform frontend, focused on the Data Agent lifecycle.

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

## Desktop (Electron)

```bash
npm install
npm run desktop:dev
```

Desktop mode will:
- start the Vue renderer in Vite dev mode
- launch the local FastAPI backend from `../DataFactory`
- expose a native directory picker for local save paths

To run the built desktop renderer:

```bash
npm run build
npm run desktop
```

## Build

```bash
npm run build
npm run preview
```

## API proxy

`vite.config.js` proxies `/api` to `http://localhost:8888`.
