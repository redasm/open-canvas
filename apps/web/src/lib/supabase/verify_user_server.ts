import { Session, User } from "@supabase/supabase-js";
import { createClient } from "./server";

export async function verifyUserAuthenticated(): Promise<
  { user: User; session: Session } | undefined
> {
  // Bypass authentication if BYPASS_AUTH is set to true
  if (process.env.BYPASS_AUTH === "true") {
    // Create mock user and session for bypass mode
    const user = { id: "bypass-user" } as User;
    const session = { user } as Session;
    return { user, session };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session) {
    return undefined;
  }
  return { user, session };
}
