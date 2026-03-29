import { About } from "@/components/landing/About";
import { Contact } from "@/components/landing/Contact";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";

/** `/` always shows marketing — no auto-redirect when logged in (use /login → dashboard or nav links). */
export default function Landing() {
  return (
    <div className="size-full">
      <Hero />
      <About />
      <Features />
      <Contact />
    </div>
  );
}
