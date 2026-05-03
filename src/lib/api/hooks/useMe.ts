"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiClient, bearerHeader } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";

type UserDto = components["schemas"]["UserDto"];
type UpdateProfileInput = components["schemas"]["UpdateProfileDto"];
type ChangePasswordInput = components["schemas"]["ChangePasswordDto"];

function useToken() {
  const { data: session } = useSession();
  return (session as { accessToken?: string } | null)?.accessToken;
}

function throwOnError(
  result: { error?: unknown; response: { status: number } },
  error: unknown
) {
  if (error) throw new ApiError(result.response.status, error);
}

export function useMe() {
  const token = useToken();

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const result = await apiClient.GET("/api/auth/me", {
        headers: bearerHeader(token),
      });
      throwOnError(result, result.error);
      return result.data as UserDto;
    },
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const token = useToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const result = await apiClient.PATCH("/api/auth/me", {
        body: input,
        headers: bearerHeader(token),
      });
      throwOnError(result, result.error);
      return result.data as UserDto;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(queryKeys.me, updatedUser);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: () => {
      toast.error("Could not save profile.");
    },
  });
}

export function useDeleteAccount() {
  const token = useToken();

  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.DELETE("/api/auth/me", {
        headers: bearerHeader(token),
      });
      throwOnError(result, result.error);
    },
  });
}

export function useChangePassword() {
  const token = useToken();

  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const result = await apiClient.POST("/api/auth/change-password", {
        body: input,
        headers: bearerHeader(token),
      });
      throwOnError(result, result.error);
    },
  });
}
