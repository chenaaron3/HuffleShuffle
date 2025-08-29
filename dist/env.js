"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const env_nextjs_1 = require("@t3-oss/env-nextjs");
const zod_1 = require("zod");
exports.env = (0, env_nextjs_1.createEnv)({
    /**
     * Specify your server-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars.
     */
    server: {
        AUTH_SECRET: process.env.NODE_ENV === "production"
            ? zod_1.z.string()
            : zod_1.z.string().optional(),
        AUTH_GOOGLE_ID: zod_1.z.string(),
        AUTH_GOOGLE_SECRET: zod_1.z.string(),
        DATABASE_URL: zod_1.z.string().url(),
        NODE_ENV: zod_1.z
            .enum(["development", "test", "production"])
            .default("development"),
        LIVEKIT_URL: zod_1.z.string().url(),
        LIVEKIT_API_KEY: zod_1.z.string(),
        LIVEKIT_API_SECRET: zod_1.z.string(),
        PUSHER_APP_ID: zod_1.z.string(),
        PUSHER_KEY: zod_1.z.string(),
        PUSHER_SECRET: zod_1.z.string(),
        PUSHER_CLUSTER: zod_1.z.string(),
        SQS_QUEUE_URL: zod_1.z.string().url(),
        AWS_REGION: zod_1.z.string().optional(),
    },
    /**
     * Specify your client-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars. To expose them to the client, prefix them with
     * `NEXT_PUBLIC_`.
     */
    client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    },
    /**
     * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
     * middlewares) or client-side so we need to destruct manually.
     */
    runtimeEnv: {
        AUTH_SECRET: process.env.AUTH_SECRET,
        AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
        AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        NODE_ENV: process.env.NODE_ENV,
        LIVEKIT_URL: process.env.LIVEKIT_URL,
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
        PUSHER_APP_ID: process.env.PUSHER_APP_ID,
        PUSHER_KEY: process.env.PUSHER_KEY,
        PUSHER_SECRET: process.env.PUSHER_SECRET,
        PUSHER_CLUSTER: process.env.PUSHER_CLUSTER,
        SQS_QUEUE_URL: process.env.SQS_QUEUE_URL,
        AWS_REGION: process.env.AWS_REGION,
    },
    /**
     * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
     * useful for Docker builds.
     */
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,
    /**
     * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
     * `SOME_VAR=''` will throw an error.
     */
    emptyStringAsUndefined: true,
});
