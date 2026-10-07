import { AccessStory } from "@/components/landing/AccessStory";
import { Evaluation } from "@/components/landing/Evaluation";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Layers } from "@/components/landing/Layers";
import { Nav } from "@/components/landing/Nav";
import { Pantheon } from "@/components/landing/Pantheon";
import { Problem } from "@/components/landing/Problem";
import { Quickstart } from "@/components/landing/Quickstart";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1280px] px-[clamp(16px,4vw,56px)]" style={{ backgroundImage: "radial-gradient(90% 60% at 50% 0%, rgba(200,96,44,.08), transparent 60%)" }}>
      <Nav /><Hero /><Problem /><Pantheon /><AccessStory /><Layers /><Evaluation /><Quickstart /><Footer />
    </div>
  );
}
