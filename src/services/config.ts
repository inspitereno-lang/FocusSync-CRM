/**
 * Application Configuration
 * 
 * Centralizes environment variables and static settings.
 * Note: Cloud API logic has been moved to native Rust commands (src-tauri/src/lib.rs).
 */
import { env } from "./env";

export const APP_CONFIG = {
  // Security (Used for initial setup/validation if needed)
  AUTH_TOKEN: (env as any).VITE_AUTH_TOKEN || "focussync-secure-prod-token-2026", 
  
  // Resilience
  RETRY_LIMIT: 5,
  RETRY_DELAY: 2000,
};
