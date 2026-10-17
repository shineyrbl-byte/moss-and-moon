import Image from "next/image";
import { photo } from "@/lib/menu";
import Reveal from "./Reveal";

export default function About() {
  return (
    <Reveal id="about" className="section about">
      <div className="about-photos">
        <div className="p1"><Image src={photo("1453614512568-c4024d13c247", 1000)} alt="Our coffee bar with hanging lights" fill sizes="(max-width: 900px) 80vw, 35vw" style={{ objectFit: "cover" }} /></div>
        <div className="p2"><Image src={photo("1497935586351-b67a49e012bf", 600)} alt="Coffee beans and a fresh latte" fill sizes="25vw" style={{ objectFit: "cover" }} /></div>
      </div>
      <div>
        <p className="eyebrow">our story</p>
        <h2>A little café for <em>soft mornings</em> and long conversations.</h2>
        <p className="lead">
          Moss & Moon started as a weekend coffee cart and grew into a corner full of plants, mismatched mugs and the smell of cardamom buns.
          We roast in small batches, bake every morning, and keep the lights low and pink after sunset.
        </p>
        <div className="stats">
          <div className="stat"><strong>12</strong><span>single-origin beans</span></div>
          <div className="stat"><strong>6am</strong><span>first bake of the day</span></div>
          <div className="stat"><strong>40+</strong><span>plants for company</span></div>
        </div>
      </div>
    </Reveal>
  );
}
