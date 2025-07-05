import type { User } from "@supabase/supabase-js";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button, Spinner, Alert } from "reactstrap";
import { supabase } from "./lib/supabaseClient";

export const AuthButton: FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setUser(user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({ provider: "github" });
    } catch {
      setError("Error signing in");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await supabase.auth.signOut();
    } catch {
      setError("Error signing out");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      {user ? (
        <>
          <span className="me-2">{user.email}</span>
          <Button color="secondary" onClick={logout} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" /> Signing out...
              </>
            ) : (
              "Sign out"
            )}
          </Button>
        </>
      ) : (
        <Button color="primary" onClick={login} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" /> Signing in...
            </>
          ) : (
            "Sign in with GitHub"
          )}
        </Button>
      )}
      {error && (
        <Alert color="danger" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
};
