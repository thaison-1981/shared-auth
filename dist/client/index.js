// src/client/use-auth.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
async function fetchUser() {
  const response = await fetch("/api/auth/user", {
    credentials: "include"
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}
async function logout() {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  window.location.href = "/";
}
function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1e3 * 60 * 5
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    }
  });
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending
  };
}
export {
  useAuth
};
