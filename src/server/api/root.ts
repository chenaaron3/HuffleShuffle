import { blindsRouter } from "~/server/api/routers/blinds";
import { setupRouter } from "~/server/api/routers/setup";
import { tableRouter } from "~/server/api/routers/table";
import { userRouter } from "~/server/api/routers/user";
import { waitlistRouter } from "~/server/api/routers/waitlist";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  table: tableRouter,
  user: userRouter,
  setup: setupRouter,
  blinds: blindsRouter,
  waitlist: waitlistRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
