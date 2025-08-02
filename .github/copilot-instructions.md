# Copilot Instructions for OpenSVM AI Coding Agents

## Project Overview
- **OpenSVM** is a Solana blockchain explorer with advanced transaction visualization, wallet path finding, and AI-powered analytics.
- Major tech: Next.js, React, TypeScript, Tailwind CSS, Solana Web3.js, D3.js, Cytoscape, XState, Qdrant, Together AI.

## Architecture & Key Patterns
- **Frontend**: `/app/` (Next.js routes, API endpoints), `/components/` (UI, visualization, hooks), `/lib/` (shared logic), `/utils/` (utility functions).
- **Transaction Graph**: See `/components/transaction-graph/README.md` for GPU/WebGL graph rendering, hooks, and layout logic. Hooks are modular and handle fetching, tracking, and rendering.
- **API**: Custom endpoints in `/app/api/` for blockchain data, analytics, and AI integration.
- **Docs**: Architectural decisions and system design in `/docs/architecture/` (start with `README.md`).
- **Type Safety**: Strong TypeScript usage; types in `/types/` and local `types.ts` files.

## Developer Workflows
- **Install**: `npm install` or `bun install`
- **Dev server**: `npm run dev` or `bun run dev`
- **Build**: `npm run build` or `bun run build`
- **Test**: `npm test` (Jest/Playwright)
- **Lint**: `npm run lint`
- **Netlify**: Use `netlify dev` for local Netlify emulation (see `.cursor/rules/netlify-development.mdc`).
- **Env**: Copy `.example.env` to `.env.local` and configure as needed.

## Project-Specific Conventions
- **Unused Vars**: Do not silence TypeScript unused variable errors without understanding context (see `.cursor/rules/unused-vars.mdc`).
- **Component Structure**: Prefer modular hooks and utility files for separation of concerns.
- **Docs**: Update `/docs/architecture/adr/` for architectural changes.
- **No CORS headers**: Never add CORS headers unless explicitly requested.
- **Netlify Functions**: Never place serverless/edge functions in `public/` or `publish/` directories.

## Integration & Data Flow
- **Solana**: Uses Solana Web3.js for blockchain data.
- **AI**: Integrates LLMs via Together AI for explanations and analytics.
- **Vector Search**: Qdrant for similarity search.
- **Visualization**: D3.js, Cytoscape, and Three.js for interactive graphs.

## References
- [Project README](/README.md)
- [Architecture Docs](/docs/architecture/README.md)
- [Transaction Graph Component](/components/transaction-graph/README.md)
- [Netlify Rules](/.cursor/rules/netlify-development.mdc)
- [Unused Vars Rule](/.cursor/rules/unused-vars.mdc)

---
**For new patterns or major changes, update this file and relevant docs.**
