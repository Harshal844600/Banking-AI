import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSupabaseSession, signOut } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useSupabaseSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="label-eyebrow text-muted-foreground">Authenticating…</p>
      </div>
    );
  }

  const nav = [
    { to: "/app", label: "Overview" },
    { to: "/app/transactions", label: "Ledger" },
    { to: "/app/advisor", label: "Advisor" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-6 md:px-8 py-4 border-b border-border bg-background sticky top-0 z-40">
        <Link to="/app" className="flex items-center gap-2">
          <div className="size-7 bg-foreground flex items-center justify-center text-background font-display font-black text-base italic">F</div>
          <span className="font-display font-bold tracking-tight">FinSight AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {nav.map(item => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase transition-colors ${
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-[10px] font-bold tracking-widest text-muted-foreground">
            {user.email}
          </span>
          <button
            onClick={() => signOut()}
            className="text-[10px] font-bold tracking-widest border border-foreground/15 px-3 py-1.5 hover:bg-secondary transition-colors"
          >
            SIGN OUT
          </button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
