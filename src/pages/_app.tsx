import '@livekit/components-styles';
import '~/styles/globals.css';

import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import { Geist } from 'next/font/google';
import { SoundProvider } from '~/components/providers/SoundProvider';
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
      <SoundProvider>
        <div className={`${geist.className} min-h-dvh bg-black`}>
          <Component {...pageProps} />
          <Toaster richColors position="bottom-right" />
        </div>
      </SoundProvider>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
