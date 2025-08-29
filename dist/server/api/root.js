"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCaller = exports.appRouter = void 0;
const post_1 = require("~/server/api/routers/post");
const setup_1 = require("~/server/api/routers/setup");
const table_1 = require("~/server/api/routers/table");
const trpc_1 = require("~/server/api/trpc");
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
exports.appRouter = (0, trpc_1.createTRPCRouter)({
    post: post_1.postRouter,
    table: table_1.tableRouter,
    setup: setup_1.setupRouter,
});
/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
exports.createCaller = (0, trpc_1.createCallerFactory)(exports.appRouter);
