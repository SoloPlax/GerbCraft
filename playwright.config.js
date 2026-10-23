// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test/ui",
  workers: 1,
  timeout: 60000,
  use: { trace: "retain-on-failure" },
  reporter: "list",
});
