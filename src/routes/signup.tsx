import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — FinSight AI" }] }),
  component: () => <AuthForm mode="signup" />,
});
