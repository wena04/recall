import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { About } from "@/components/landing/About";
import { Contact } from "@/components/landing/Contact";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { supabase } from "@/lib/supabase";

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  return (
    <div className="size-full">
      <Hero />
      <About />
      <Features />
      <Contact />
    </div>
  );
}
