import { createSupabaseClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { enhancedCacheManager } from "@/lib/cache/enhanced-cache-manager";
import { useErrorHandler } from "@/hooks/use-error-handler";

type UserContentType = {
  getUser: () => Promise<User | undefined>;
  user: User | undefined;
  loading: boolean;
};

const UserContext = createContext<UserContentType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);
  const cacheManager = enhancedCacheManager;
  const { handleError } = useErrorHandler();

  useEffect(() => {
    if (user || typeof window === "undefined") return;

    getUser();
  }, []);

  async function getUser() {
    if (user) {
      setLoading(false);
      return user;
    }

    try {
      // 尝试从缓存获取用户信息
      const cacheKey = 'user:current';
      const cachedUser = await cacheManager.get<User>(cacheKey);
      
      if (cachedUser) {
        console.log('✅ 从缓存加载用户信息');
        setUser(cachedUser);
        setLoading(false);
        return cachedUser;
      }

      // 缓存未命中，从Supabase获取
      console.log('🔄 从Supabase获取用户信息');
      const supabase = createSupabaseClient();

      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();
      
      const userData = supabaseUser || undefined;
      setUser(userData);
      
      // 缓存用户信息（5分钟）
      if (userData) {
        await cacheManager.set(cacheKey, userData, 300);
      }
      
      setLoading(false);
      return userData;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'get_user',
        component: 'UserProvider'
      });
      setLoading(false);
      return undefined;
    }
  }

  const contextValue: UserContentType = {
    getUser,
    user,
    loading,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
