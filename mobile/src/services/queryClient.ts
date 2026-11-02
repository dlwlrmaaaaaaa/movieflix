import { QueryClient } from '@tanstack/react-query';

// One in-memory client cache. Nothing is persisted, including credentials.
export const queryClient = new QueryClient({
  defaultOptions: { queries: {
    staleTime: 2 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failures, error) => failures < 1 && (error as Error & { status?: number }).status !== 429 && ((error as Error & { status?: number }).status ?? 503) >= 500,
    retryDelay: 1000,
  } },
});
