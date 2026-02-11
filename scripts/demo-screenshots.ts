#!/usr/bin/env tsx
/**
 * Demo screenshots script for OpenClutch
 *
 * Uses Playwright to capture high-quality screenshots of the demo environment.
 *
 * Usage:
 *   pnpm demo:screenshots
 *
 * Prerequisites:
 *   - Demo environment running (pnpm demo:up)
 *   - Demo data seeded (pnpm demo:seed)
 *   - Dev server running on port 3003 (pnpm dev with PORT=3003)
 */

import { chromium, type Browser, type Page } from "@playwright/test"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

const BASE_URL = "http://localhost:3003"
const OUTPUT_DIR = "./docs"

// Screenshots needed for README
const SCREENSHOTS = [
  {
    file: "observatory-screenshot.png",
    path: "/work-loop",
    description: "Observatory Live tab with multiple projects, active agents, recent activity",
    waitFor: 8000,
    fullPage: false,
  },
  {
    file: "board-screenshot.png",
    path: "/projects/acme-api/board",
    description: "Kanban board with tasks in Backlog, Ready, In Progress, In Review, Done",
    waitFor: 10000,
    fullPage: false,
  },
  {
    file: "chat-screenshot.png",
    path: "/projects/acme-api/chat",
    description: "Chat page with agent conversation messages",
    waitFor: 10000,
    fullPage: false,
  },
  {
    file: "work-loop-screenshot.png",
    path: "/work-loop?tab=analytics",
    description: "Analytics tab with cost/performance charts",
    waitFor: 8000,
    fullPage: false,
  },
  {
    file: "roadmap-screenshot.png",
    path: "/projects/acme-api/roadmap",
    description: "Roadmap with phases, requirements, coverage",
    waitFor: 10000,
    fullPage: false,
  },
  {
    file: "sessions-screenshot.png",
    path: "/sessions",
    description: "Sessions list with token counts, costs, models, durations",
    waitFor: 8000,
    fullPage: false,
  },
  {
    file: "prompt-lab-screenshot.png",
    path: "/prompts",
    description: "Prompt Lab with role templates, versions, amendments",
    waitFor: 8000,
    fullPage: false,
  },
]

async function hideScrollbars(page: Page) {
  await page.addStyleTag({
    content: `
      ::-webkit-scrollbar { display: none !important; }
      body { scrollbar-width: none !important; }
    `,
  })
}

async function optimizePng(filePath: string) {
  try {
    // Try pngquant first, then optipng as fallback
    try {
      execSync(`pngquant --force --quality=80-95 --output "${filePath}" "${filePath}"`, {
        stdio: "ignore",
      })
    } catch {
      execSync(`optipng -o2 "${filePath}"`, { stdio: "ignore" })
    }
  } catch {
    // Optimization failed, but file still exists
  }
}

async function takeScreenshot(browser: Browser, config: typeof SCREENSHOTS[0]) {
  const url = `${BASE_URL}${config.path}`
  const outputPath = path.join(OUTPUT_DIR, config.file)

  console.log(`   📷 ${config.description}`)
  console.log(`      URL: ${url}`)

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()

  try {
    // Navigate to page
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })

    // Wait for content to load
    await page.waitForTimeout(config.waitFor)

    // Hide scrollbars for clean screenshot
    await hideScrollbars(page)

    // Additional wait for any animations to complete
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: config.fullPage,
      type: "png",
    })

    // Optimize the PNG
    await optimizePng(outputPath)

    const stats = fs.statSync(outputPath)
    const sizeKB = Math.round(stats.size / 1024)

    console.log(`      ✓ Saved (${sizeKB}KB)`)
  } catch (error) {
    console.error(`      ✗ Failed:`, error instanceof Error ? error.message : error)
    throw error
  } finally {
    await context.close()
  }
}

async function main() {
  console.log("📸 OpenClutch Demo Screenshots")
  console.log("   Base URL:", BASE_URL)
  console.log("   Output:", OUTPUT_DIR)
  console.log()

  // Check if dev server is running
  try {
    const response = await fetch(BASE_URL)
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`)
    }
  } catch {
    console.error("❌ Dev server not responding at", BASE_URL)
    console.error("   Make sure to run: PORT=3003 pnpm dev")
    process.exit(1)
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Launch browser
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: true })

  console.log("Taking screenshots...")
  console.log()

  let successCount = 0
  let failCount = 0

  for (const screenshot of SCREENSHOTS) {
    try {
      await takeScreenshot(browser, screenshot)
      successCount++
    } catch {
      failCount++
    }
    console.log()
  }

  await browser.close()

  console.log("✅ Screenshot capture complete!")
  console.log(`   Success: ${successCount}, Failed: ${failCount}`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("❌ Screenshot script failed:", error)
  process.exit(1)
})
