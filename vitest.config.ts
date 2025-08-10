import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["dotenv/config", "src/test/setup.ts"],
    deps: { inline: ["next-auth", "@auth/drizzle-adapter"] },
    include: ["src/**/*.test.ts"],
    testTimeout: 2000000,
    hookTimeout: 2000000,
  },
});
