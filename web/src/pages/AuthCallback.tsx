import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * OAuth (PKCE) return URL — add this path to Supabase → Auth → Redirect URLs.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) {
            setMessage(error.message);
            setTimeout(() => navigate("/login", { replace: true }), 2000);
            return;
          }
        }
        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };
    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 text-stone-600">
      {message}
    </div>
  );
}
