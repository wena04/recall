import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Features } from "./components/Features";
import { Contact } from "./components/Contact";

export default function App() {
  return (
    <div className="size-full">
      <Hero />
      <About />
      <Features />
      <Contact />
    </div>
  );
}
