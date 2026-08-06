import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import type { Session } from 'next-auth';
import { auth } from '~/server/auth';

type AuthPageProps = {
  session: Session;
};

export async function requireAuth(
  context: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<AuthPageProps>> {
  const session = await auth(context);

  if (!session) {
    const callbackUrl = encodeURIComponent(context.resolvedUrl);
    return {
      redirect: {
        destination: `/login?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }

  return { props: { session } };
}

export async function requireDealerAuth(
  context: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<AuthPageProps>> {
  const result = await requireAuth(context);
  if (!("props" in result)) return result;

  const props = await Promise.resolve(result.props);

  if (props.session.user.role !== "dealer") {
    return {
      redirect: {
        destination: "/lobby",
        permanent: false,
      },
    };
  }

  return { props };
}

export async function redirectIfAuthenticated(
  context: GetServerSidePropsContext,
  fallbackDestination = '/lobby',
): Promise<GetServerSidePropsResult<Record<string, never>>> {
  const session = await auth(context);

  if (session) {
    const callbackUrl =
      typeof context.query.callbackUrl === 'string' && context.query.callbackUrl.startsWith('/')
        ? context.query.callbackUrl
        : fallbackDestination;

    return {
      redirect: {
        destination: callbackUrl,
        permanent: false,
      },
    };
  }

  return { props: {} };
}
