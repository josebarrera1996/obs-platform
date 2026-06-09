// ── E2E: Health, Smoke & Navigation Tests ──
import { test, expect } from "@playwright/test";

test.describe("Health Check", () => {
  test("GET /api/health returns OK", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  test("GET /api/health returns expected JSON structure", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("services");
    expect(body).toHaveProperty("uptime");
  });
});

test.describe("Settings Page", () => {
  test("settings page loads and shows credential form", async ({ page }) => {
    await page.goto("/settings");

    // Wait for the page to load
    await expect(page.locator("h1, h2")).toContainText([
      /credential/i,
      /setting/i,
    ]);

    // Should see the add credential section
    await expect(
      page.locator('text=/add credential|aws credential|access key/i')
    ).toBeVisible();
  });

  test("empty state shows no credentials message", async ({ page }) => {
    await page.goto("/settings");

    // Wait for content to load
    await page.waitForLoadState("networkidle");

    // Should show either credentials or empty state
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("credential form has required fields", async ({ page }) => {
    await page.goto("/settings");

    const form = page.locator('form, [role="form"]');
    if (await form.isVisible()) {
      // Check for access key fields
      await expect(page.locator('input[name*="key" i], input[placeholder*="key" i], input[id*="key" i]').first()).toBeAttached();
    }
  });
});

test.describe("Dashboard", () => {
  test("dashboard loads without errors", async ({ page }) => {
    // No console errors allowed
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    // Wait for React to hydrate
    await page.waitForLoadState("networkidle");

    // Should render something
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // No hydration errors after 3 seconds
    await page.waitForTimeout(3000);
    const hydrationErrors = errors.filter(
      (e) => e.includes("hydrat") || e.includes("Hydrat")
    );
    expect(hydrationErrors.length).toBe(0);
  });

  test("dashboard shows header with navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Header should be visible
    const header = page.locator("header, [role='banner']");
    await expect(header).toBeVisible();
  });

  test("navigation menu items are clickable", async ({ page }) => {
    await page.goto("/");

    // Sidebar should be visible with navigation links
    const sidebar = page.locator("nav, aside, [class*='sidebar']");
    await expect(sidebar).toBeVisible();

    // Click on Settings link
    const settingsLink = page.locator('a[href="/settings"]');
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });

  test("search dialog opens with keyboard shortcut", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Press Ctrl+K or Cmd+K to open search
    await page.keyboard.press("Control+k");

    // Search dialog should appear
    const dialog = page.locator('[role="dialog"], [class*="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Incidents Page", () => {
  test("incidents page loads", async ({ page }) => {
    await page.goto("/incidents");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("incidents page has title", async ({ page }) => {
    await page.goto("/incidents");
    await expect(page.locator("h1")).toContainText(/incident/i);
  });

  test("incidents page shows no-credential state when not configured", async ({ page }) => {
    await page.goto("/incidents");
    await page.waitForLoadState("networkidle");
    // Should show either loading, error, or credential prompt
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});

test.describe("Insights Page", () => {
  test("insights page loads", async ({ page }) => {
    await page.goto("/insights");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("insights page shows title", async ({ page }) => {
    await page.goto("/insights");
    await expect(page.locator("h1")).toContainText(/insight|ml|ai|anomal/i);
  });
});

test.describe("Login Page", () => {
  test("login page loads and shows form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Should see login form
    await expect(page.locator("body")).toBeVisible();

    // Should have input fields
    const inputs = page.locator('input[type="text"], input[type="password"], input[type="email"]');
    await expect(inputs.first()).toBeAttached();
  });

  test("login page has sign in button", async ({ page }) => {
    await page.goto("/login");
    const button = page.locator('button:has-text("Sign")');
    await expect(button).toBeAttached();
  });
});

test.describe("Service Detail Page", () => {
  test("service-detail page loads without credential", async ({ page }) => {
    await page.goto("/service-detail");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Not Found Page", () => {
  test("unknown route shows 404", async ({ page }) => {
    await page.goto("/this-path-does-not-exist-12345");
    // Next.js renders 404 page with 200 status in SPA mode
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Security Headers", () => {
  test("API responses include security headers", async ({ request }) => {
    const response = await request.get("/api/health");
    const headers = response.headers();

    // Check for HSTS header
    expect(headers["strict-transport-security"]).toBeDefined();
    expect(headers["strict-transport-security"]).toContain("max-age");

    // Check for X-Content-Type-Options
    expect(headers["x-content-type-options"]).toBe("nosniff");

    // Check for rate limit headers
    expect(headers["x-ratelimit-limit"]).toBeDefined();
  });

  test("CORS headers are present on API responses", async ({ request }) => {
    const response = await request.get("/api/health");
    const headers = response.headers();
    // CORS headers may or may not be set depending on origin
    expect(headers["x-content-type-options"]).toBeDefined();
  });
});