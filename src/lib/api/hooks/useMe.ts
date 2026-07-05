"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import type { components } from "@/lib/api/schema";

type UserDto = components["schemas"]["UserDto"];
type UpdateProfileInput = components["schemas"]["UpdateProfileDto"];
type ChangePasswordInput = components["schemas"]["ChangePasswordDto"];

// No tokens in the client — the /api/backend auth proxy attaches the Bearer
// header server-side from the httpOnly session cookie.
function useAuthed() {
  const { status } = useSession();
  return status === "authenticated";
}

function throwOnError(
  result: { error?: unknown; response: { status: number } },
  error: unknown
) {
  if (error) throw new ApiError(result.response.status, error);
}

export function useMe() {
  const authed = useAuthed();

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const result = await apiClient.GET("/api/auth/me");
      throwOnError(result, result.error);
      return result.data as UserDto;
    },
    enabled: authed,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const result = await apiClient.PATCH("/api/auth/me", {
        body: input,
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
  return useMutation({
    mutationFn: async () => {
      const result = await apiClient.DELETE("/api/auth/me");
      throwOnError(result, result.error);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const result = await apiClient.POST("/api/auth/change-password", {
        body: input,
      });
      throwOnError(result, result.error);
    },
  });
}
