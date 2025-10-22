import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { ProviderButtons } from "@/components/auth/ProviderButtons";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/picks");
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Choose a provider to continue.</p>
      </div>
      <ProviderButtons />
      <p className="text-xs text-muted">
        By continuing, you agree to our Terms of Service and acknowledge our Privacy Policy.
      </p>
    </main>
  );
}
