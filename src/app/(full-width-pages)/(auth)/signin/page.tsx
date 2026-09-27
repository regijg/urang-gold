import { redirect } from "next/navigation";

// Legacy route — login now lives at /login
export default function SignIn() {
  redirect("/login");
}
