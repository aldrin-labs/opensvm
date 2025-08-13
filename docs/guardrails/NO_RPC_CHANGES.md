# Guardrail: Do NOT modify RPC logic

Date: 2025-08-12

- The RPC configuration, selection, and proxy logic are considered stable and must not be changed unless explicitly requested by a maintainer.
- Use the existing client/server connection facades and RPC proxy endpoints as-is.
- If tests or features need different behavior, prefer configuration (cookies, settings) or add narrowly scoped code that does not alter core RPC modules.

This memo is for AI coding agents and contributors to reduce churn and prevent regressions.
