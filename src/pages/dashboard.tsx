import { type PaginationState } from "@tanstack/react-table";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  DASHBOARD_PAGE_SIZE,
  DASHBOARD_TABS,
  parseDashboardTab,
  type DashboardTab,
} from "~/components/dashboard/constants";
import { HandsTab } from "~/components/dashboard/hands-tab";
import { PlayersTab } from "~/components/dashboard/players-tab";
import { WaitlistTab } from "~/components/dashboard/waitlist-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireDealerAuth } from "~/server/auth/guards";

import type { GetServerSideProps } from "next";

const TAB_LABELS: Record<DashboardTab, string> = {
  waitlist: "Waitlist",
  players: "Players",
  hands: "Hands",
};

const initialPagination: PaginationState = {
  pageIndex: 0,
  pageSize: DASHBOARD_PAGE_SIZE,
};

export default function DashboardPage() {
  const router = useRouter();
  const activeTab = parseDashboardTab(router.query.tab);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);

  useEffect(() => {
    setPagination(initialPagination);
  }, [activeTab]);

  const setTab = (tab: string) => {
    void router.push(
      { pathname: "/dashboard", query: { tab } },
      undefined,
      { shallow: true },
    );
  };

  return (
    <>
      <Head>
        <title>Dashboard - HuffleShuffle</title>
      </Head>
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div>
              <Link
                href="/lobby"
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                ← Back to Lobby
              </Link>
              <h1 className="mt-2 text-2xl font-semibold">Dashboard</h1>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setTab} className="gap-6">
            <TabsList variant="line" className="h-auto w-full justify-start gap-0 border-b border-white/10 bg-transparent p-0">
              {DASHBOARD_TABS.map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none px-4 py-3 text-zinc-500 hover:text-zinc-300 data-[state=active]:text-white data-[state=active]:after:bg-white data-[state=active]:after:opacity-100"
                >
                  {TAB_LABELS[tab]}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="waitlist">
              <WaitlistTab
                pagination={pagination}
                onPaginationChange={setPagination}
              />
            </TabsContent>
            <TabsContent value="players">
              <PlayersTab
                pagination={pagination}
                onPaginationChange={setPagination}
              />
            </TabsContent>
            <TabsContent value="hands">
              <HandsTab
                pagination={pagination}
                onPaginationChange={setPagination}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = requireDealerAuth;
