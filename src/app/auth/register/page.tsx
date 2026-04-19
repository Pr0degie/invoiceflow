import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthLayout heading="Create an account" subheading="Free to start, upgrade anytime">
      <RegisterForm />
    </AuthLayout>
  );
}
