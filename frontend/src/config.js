export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");
export const PREVIEW = import.meta.env.VITE_PREVIEW === "true";
