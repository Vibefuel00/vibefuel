import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { LoginForm } from "@/components/app/login-form"
import { currentDeveloper } from "@/lib/auth"

export const metadata = { title: "Sign in — Vibefuel" }

export default async function DeveloperLoginPage() {
  const dev = await currentDeveloper()
  if (dev) redirect("/dashboard")
  return (
    <main className="app-shell dev-shell">
      <SiteHeader mode="developer" signedIn={false} />
      <section className="app-narrow">
        <LoginForm />
      </section>
    </main>
  )
}
