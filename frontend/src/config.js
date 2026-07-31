/**
 * API Configuration
 * In local dev: defaults to '' (uses Vite dev proxy to http://localhost:3001)
 * In production (Vercel): uses VITE_API_BASE_URL environment variable if set
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
