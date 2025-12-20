import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["auth"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/user");
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  return {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
