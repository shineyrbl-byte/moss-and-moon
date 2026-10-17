import Hero from "@/components/Hero";
import About from "@/components/About";
import Menu from "@/components/Menu";
import Quiz from "@/components/Quiz";
import Gallery from "@/components/Gallery";
import Events from "@/components/Events";
import Reviews from "@/components/Reviews";
import Visit from "@/components/Visit";
import Newsletter from "@/components/Newsletter";

const MARQUEE = ["☕ pour-overs", "🌸 rose lattes", "🍵 ceremonial matcha", "🥐 croissants at 6am", "☾ night café vibes", "✿ oat milk, always"];

export default function Home() {
  return (
    <>
      <Hero />
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}
        </div>
      </div>
      <About />
      <Menu />
      <Quiz />
      <Gallery />
      <Events />
      <Reviews />
      <Visit />
      <Newsletter />
    </>
  );
}
