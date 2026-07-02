import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface AuthUser {
  id: string | null; // null for the offline demo user
  email: string;
  demo?: boolean;
}

export interface AuthResult {
  error: string | null;
}

const DEMO_KEY = "mo:demo-user";

function loadDemoUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Authentication. When Supabase is configured this wraps Supabase Auth
 * (email/password + Google OAuth) and tracks the live session. When it isn't
 * (the offline demo), it falls back to a local "demo user" persisted to
 * localStorage so the whole sign-in UX stays testable.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => (supabase ? null : loadDemoUser()));
  const [loading, setLoading] = useState<boolean>(!!supabase);

  useEffect(() => {
    if (!supabase) return; // loading already initialised to false when unconfigured
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const s = data.session;
      setUser(s ? { id: s.user.id, email: s.user.email ?? "" } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? { id: session.user.id, email: session.user.email ?? "" } : null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setDemo = (email: string) => {
    const u: AuthUser = { id: null, email, demo: true };
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setUser(u);
  };

  const signInEmail = async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) {
      setDemo(email.trim());
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const signUpEmail = async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) {
      setDemo(email.trim());
      return { error: null };
    }
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const signInGoogle = async (): Promise<AuthResult> => {
    if (!supabase) {
      setDemo("guest@google.demo");
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) {
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {
        /* ignore */
      }
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, configured: !!supabase, signInEmail, signUpEmail, signInGoogle, signOut };
}
