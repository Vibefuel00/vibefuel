import { redirect } from "next/navigation"

/** The key is created in a modal on the home page; keep the old link working. */
export default function StartPage() {
  redirect("/#start")
}
