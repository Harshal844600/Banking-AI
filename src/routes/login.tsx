import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — FinSight AI" }] }),
  component: LoginPage,
});

function LoginPage() {
  return <AuthForm mode="login" />;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const { user } = useSupabaseSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/app",
        },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  const isLogin = mode === "login";
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background text-foreground">
      <aside className="hidden md:flex flex-col justify-between p-12 bg-foreground text-background">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 bg-background text-foreground flex items-center justify-center font-display font-black text-xl italic">
            F
          </div>
          <span className="font-display font-bold tracking-tight text-xl">FinSight AI</span>
        </Link>
        <div>
          <p className="label-eyebrow text-background/60 mb-4">Intelligence is the new capital</p>
          <h2 className="font-display text-5xl font-black leading-[0.95] tracking-tighter">
            YOUR WEALTH,
            <br />
            ARCHITECTED.
          </h2>
        </div>
        <p className="text-[10px] font-bold tracking-[0.2em] text-background/40">
          ENCRYPTED END-TO-END
        </p>
      </aside>

      <main className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <p className="label-eyebrow text-muted-foreground mb-3">
            {isLogin ? "Returning user" : "New account"}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-8">
            {isLogin ? "Welcome back." : "Create your account."}
          </h1>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="w-full mb-4 px-4 py-3 border border-foreground/15 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label-eyebrow block mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-foreground/15 bg-background text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="label-eyebrow block mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-foreground/15 bg-background text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-3 bg-foreground text-background text-sm font-bold tracking-wide hover:bg-accent transition-colors disabled:opacity-50"
            >
              {busy ? "…" : isLogin ? "LOG IN" : "CREATE ACCOUNT"}
            </button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            {isLogin ? (
              <>
                No account?{" "}
                <Link to="/signup" className="font-semibold text-foreground hover:text-accent">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have one?{" "}
                <Link to="/login" className="font-semibold text-foreground hover:text-accent">
                  Log in
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.97 6.97 0 010-4.18V7.07H2.18a11 11 0 000 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
