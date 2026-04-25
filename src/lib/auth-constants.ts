// Tiny module that's safe to import from middleware (Edge runtime) — no
// Node-only imports. Keep anything that pulls in node:crypto in auth.ts.

export const SESSION_COOKIE_NAME = "rostermate_mgr_session";
