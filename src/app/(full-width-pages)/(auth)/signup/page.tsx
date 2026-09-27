import { redirect } from "next/navigation";

// Legacy route — registration now lives at /register
export default function SignUp() {
  redirect("/register");
}
