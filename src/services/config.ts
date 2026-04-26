/**
 * Application Configuration
 * 
 * Centralizes environment variables and static settings.
 */
import { env } from "./env";

export const APP_CONFIG = {
  // Cloud API Configuration
  CLOUD_API_BASE: (env as any).VITE_API_URL || "http://localhost:5001", 
  SYNC_ENDPOINT: "/sync",
  
  // Security
  AUTH_TOKEN: (env as any).VITE_AUTH_TOKEN || "focussync-secure-prod-token-2026", 
  
  // Resilience
  RETRY_LIMIT: 5,
  RETRY_DELAY: 2000,
};

export const getApiUrl = (path: string) => `${APP_CONFIG.CLOUD_API_BASE}${path}`;
