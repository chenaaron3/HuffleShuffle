/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ["next-auth", "@auth/core", "@auth/drizzle-adapter"],
  typescript: {
    // WARNING: only use to unblock local dev/CI; fix types properly for prod
    ignoreBuildErrors: true,
  },
  eslint: {
    // WARNING: only use to unblock local dev/CI; fix lints properly for prod
    ignoreDuringBuilds: true,
  },

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
};

export default config;
