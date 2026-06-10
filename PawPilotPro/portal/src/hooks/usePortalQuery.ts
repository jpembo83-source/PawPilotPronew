import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getPortalApi } from "@/lib/api";

export function usePortalQuery<T>(
  key: readonly unknown[],
  path: string,
  opts?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => getPortalApi().get<T>(path),
    staleTime: 30_000,
    ...opts,
  });
}
