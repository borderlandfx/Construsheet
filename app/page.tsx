import { redirect } from "next/navigation";

// The root URL redirects to /dashboard.
// The middleware handles the auth check:
//   – unauthenticated → /auth/login
//   – authenticated   → /dashboard  (and this page is never rendered)
export default function RootPage() {
  redirect("/dashboard");
}
