import { Session, User } from "@supabase/supabase-js";
import { createClient } from "./server";

export async function verifyUserAuthenticated(): Promise<
  { user: User; session: Session } | undefined
> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return undefined;
  }

  // 使用getUser()返回的user对象，它已经经过验证
  // 创建一个模拟的session对象，包含必要的用户信息
  const session: Session = {
    access_token: '', // 在实际使用中，如果需要token，应该从其他地方获取
    refresh_token: '',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: user,
  };

  return { user, session };
}
