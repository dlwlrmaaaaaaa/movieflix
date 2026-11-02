import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Postgres is included on every Neon branch. Prisma uses DATABASE_URL for
  // queries and DATABASE_URL_UNPOOLED for migrations. Keep existing app auth.
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
