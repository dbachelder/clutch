/**
 * Default user configuration
 * 
 * TODO: Replace with actual user authentication when multi-user support is added.
 * For now, this centralizes the default username to avoid hardcoding "dan" 
 * throughout the codebase.
 */
export const DEFAULT_USER = {
  name: "user",
  displayName: "User",
} as const

/**
 * System authors/identities used for automated messages
 */
export const SYSTEM_AUTHORS = {
  ada: "ada",
  system: "system",
} as const
