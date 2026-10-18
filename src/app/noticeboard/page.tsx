import Noticeboard from "@/components/Noticeboard";

export default function NoticeboardPage() {
  return (
    <div className="page" style={{ maxWidth: "64rem" }}>
      <p className="eyebrow">the noticeboard</p>
      <h1 className="h2">Pinned by <em>our regulars</em></h1>
      <p className="lead">Lost something? Looking for a study buddy or swapping a book? Pin a note. A barista checks each one before it goes up.</p>
      <div style={{ marginTop: "1.5rem" }}><Noticeboard /></div>
    </div>
  );
}
