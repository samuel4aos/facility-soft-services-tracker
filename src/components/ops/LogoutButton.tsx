"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={() =>
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          window.location.href = "/login?mode=password";
        })
      }
      className="rounded-lg bg-slate-900 px-3 py-1.5 text-white"
    >
      Sign out
    </button>
  );
}
