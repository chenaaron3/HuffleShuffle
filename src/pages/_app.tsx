import '@livekit/components-styles';
import '~/styles/globals.css';

import { SessionProvider } from 'next-auth/react';
import { Geist } from 'next/font/google';
import { Toaster } from '~/components/ui/sonner';
import { api } from '~/utils/api';

import type { Session } from 'next-auth';
import type { AppType } from 'next/app';
const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div className={geist.className}>
        <Component {...pageProps} />
        <Toaster richColors position="bottom-right" />
      </div>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
