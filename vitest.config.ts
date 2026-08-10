import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Opt-in soak suites (headless bots, PHH). Default `npm test` excludes them.
const includeSoak = process.env.VITEST_SOAK === "1";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["dotenv/config", "src/test/setup.ts"],
    deps: { inline: ["next-auth", "@auth/drizzle-adapter"] },
    include: ["src/**/*.test.ts"],
    exclude: includeSoak
      ? []
      : [
          "src/test/headless-bot-game.runner.test.ts",
          "src/test/simulation/run-phh-tests.test.ts",
        ],
    testTimeout: 2000000,
    hookTimeout: 2000000,
  },
});
