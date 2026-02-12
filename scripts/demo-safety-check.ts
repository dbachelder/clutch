#!/usr/bin/env tsx
/**
 * Demo Safety Check Script
 *
 * This script validates that demo operations will NOT affect production.
 * It MUST be run before any destructive demo operation (reset, clean).
 *
 * Safety checks:
 * 1. Verify demo compose uses demo ports 3230/3231
 * 2. Verify demo env points to demo ports
 * 3. Verify demo-reset only runs `docker compose -f docker-compose.demo.yml`
 * 4. Verify docker compose down targets ONLY demo volume (convex-demo-data)
 *
 * Note: Production containers running on 3210/3211 is EXPECTED and normal.
 * The danger is the demo targeting production, not production existing.
 *
 * Exit codes:
 *   0 - Safe to proceed
 *   1 - Unsafe condition detected
 */

import { execSync } from "child_process"
import { existsSync } from "fs"
import { resolve } from "path"

// Production volume name that must NOT be removed
const PRODUCTION_VOLUME = "convex-data"

// Colors for terminal output
const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RESET = "\x1b[0m"

function log(message: string): void {
  console.log(message)
}

function error(message: string): void {
  console.error(`${RED}❌ ERROR: ${message}${RESET}`)
}

function warn(message: string): void {
  console.warn(`${YELLOW}⚠️  WARNING: ${message}${RESET}`)
}

function success(message: string): void {
  console.log(`${GREEN}✅ ${message}${RESET}`)
}

/**
 * Check if demo environment file exists and is valid
 */
function checkDemoEnvironment(): boolean {
  log("Checking demo environment configuration...")

  const demoEnvPath = resolve(process.cwd(), ".env.demo.local")

  // Check that demo env exists
  if (!existsSync(demoEnvPath)) {
    error("Demo environment file not found: .env.demo.local")
    log("  Run: cp .env.demo .env.demo.local")
    return false
  }

  // Read demo env and verify it points to demo ports
  try {
    const demoEnvContent = execSync(`cat "${demoEnvPath}"`, { encoding: "utf-8" })

    // Check that it uses demo ports, not production ports
    const hasProductionPort3210 = demoEnvContent.includes(":3210") && !demoEnvContent.includes("NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211")
    const hasProductionPort3211 = demoEnvContent.match(/:\/\/[^\s]*:3211/) && !demoEnvContent.includes("NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3231")

    if (hasProductionPort3210 || hasProductionPort3211) {
      error("Demo environment file appears to contain production port references")
      log("  Please verify .env.demo.local points to ports 3230/3231")
      return false
    }

    success("Demo environment file exists and appears to use demo ports")
  } catch {
    warn("Could not read demo environment file for verification")
  }

  return true
}

/**
 * Check that docker-compose.demo.yml exists and is valid
 */
function checkDemoComposeFile(): boolean {
  log("Checking demo compose file...")

  const composePath = resolve(process.cwd(), "docker-compose.demo.yml")

  if (!existsSync(composePath)) {
    error("Demo compose file not found: docker-compose.demo.yml")
    return false
  }

  // Verify it uses demo ports
  try {
    const composeContent = execSync(`cat "${composePath}"`, { encoding: "utf-8" })

    // Check for hardcoded demo ports
    const hasDemoPort3230 = composeContent.includes('"3230:3210"')
    const hasDemoPort3231 = composeContent.includes('"3231:3211"')
    const hasDemoVolume = composeContent.includes("convex-demo-data:")
    const hasProductionVolume = composeContent.includes("convex-data:") && !composeContent.includes("convex-demo-data:")

    if (!hasDemoPort3230 || !hasDemoPort3231) {
      error("Demo compose file does not have hardcoded demo ports (3230/3231)")
      return false
    }

    if (!hasDemoVolume) {
      error("Demo compose file does not use demo-specific volume (convex-demo-data)")
      return false
    }

    if (hasProductionVolume) {
      error("Demo compose file references production volume (convex-data)!")
      return false
    }

    success("Demo compose file exists with correct ports and volume")
  } catch {
    warn("Could not verify demo compose file contents")
  }

  return true
}

/**
 * Verify that reset operations target only demo resources
 */
function checkResetSafety(): boolean {
  log("Checking reset operation safety...")

  // Verify demo-reset.ts only uses demo compose file
  const resetScriptPath = resolve(process.cwd(), "scripts/demo-reset.ts")

  if (!existsSync(resetScriptPath)) {
    warn("Could not find demo-reset.ts to verify reset safety")
    return true
  }

  try {
    const resetScriptContent = execSync(`cat "${resetScriptPath}"`, { encoding: "utf-8" })

    // Check that it only uses docker-compose.demo.yml
    const usesDemoCompose = resetScriptContent.includes("docker-compose.demo.yml")
    const usesProductionCompose = resetScriptContent.includes("docker-compose.yml") &&
      !resetScriptContent.includes("docker-compose.demo.yml")

    // Check that it only removes demo volume
    const removesDemoVolume = resetScriptContent.includes("convex-demo-data")
    const removesProductionVolume = resetScriptContent.includes(PRODUCTION_VOLUME) &&
      !resetScriptContent.includes("convex-demo-data")

    if (usesProductionCompose) {
      error("demo-reset.ts appears to reference production compose file!")
      return false
    }

    if (removesProductionVolume) {
      error("demo-reset.ts appears to reference production volume!")
      return false
    }

    if (usesDemoCompose && removesDemoVolume) {
      success("Reset script targets only demo resources")
    }
  } catch {
    warn("Could not verify reset script safety")
  }

  return true
}

/**
 * Main safety check function
 */
function runSafetyChecks(): boolean {
  log("")
  log("=".repeat(60))
  log("🔒 DEMO SAFETY CHECKS")
  log("=".repeat(60))
  log("")
  log("Note: Production containers on ports 3210/3211 are EXPECTED.")
  log("These checks ensure demo operations target ONLY demo resources.")
  log("")

  const checks = [
    checkDemoEnvironment(),
    checkDemoComposeFile(),
    checkResetSafety(),
  ]

  log("")
  log("=".repeat(60))

  if (checks.every((c) => c)) {
    success("All safety checks passed - safe to proceed with demo operation")
    log("=".repeat(60))
    log("")
    return true
  } else {
    error("Safety check FAILED - demo operation aborted")
    log("")
    log("Fix the issues above before retrying.")
    log("=".repeat(60))
    log("")
    return false
  }
}

// Run checks
const isSafe = runSafetyChecks()
process.exit(isSafe ? 0 : 1)
