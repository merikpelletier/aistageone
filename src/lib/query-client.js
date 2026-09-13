import { QueryClient } from '@tanstack/react-query';

// Retry logic with exponential backoff for rate limits
const shouldRetry = (failureCount, error) => {
  // Retry on rate limit (429) or network errors, up to 3 times
  if (error?.response?.status === 429 || error?.message?.includes('Rate limit')) {
    return failureCount < 3;
  }
  // Retry on network errors
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return failureCount < 3;
  }
  return false;
};

const getRetryDelay = (failureCount, error) => {
  // Exponential backoff: 1s, 2s, 4s
  if (error?.response?.status === 429 || error?.message?.includes('Rate limit')) {
    return Math.min(1000 * Math.pow(2, failureCount), 5000);
  }
  return 1000;
};

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: shouldRetry,
			retryDelay: getRetryDelay,
		},
	},
});