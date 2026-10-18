"use client";
import Reveal from "./Reveal";
import Noticeboard from "./Noticeboard";

export default function NoticeboardTeaser() {
  return (
    <Reveal id="noticeboard" className="section">
      <div className="center">
        <p className="eyebrow">the noticeboard</p>
        <h2>Pinned by <em>our regulars</em></h2>
        <p className="lead">Lost &amp; found, study buddies, book swaps. Pin a note and a barista puts it up.</p>
      </div>
      <div style={{ marginTop: "1.5rem" }}><Noticeboard compact /></div>
    </Reveal>
  );
}
