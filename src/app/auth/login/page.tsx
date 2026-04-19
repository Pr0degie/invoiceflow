import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthLayout heading="Welcome back" subheading="Sign in to your account">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
