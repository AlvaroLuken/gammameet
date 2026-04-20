import { signOut } from "@/lib/auth";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default function SignOutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
      <form action={handleSignOut}>
        <button
          type="submit"
          className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer"
        >
          Sign out of GammaMeet
        </button>
      </form>
    </div>
  );
}
