// A tiny, safe text formatter for newsletters and journal posts.
// Everything is escaped first, then a few simple marks become formatting:
//   ## Heading   **bold**   *italic*   [link text](https://…)   - list item   blank line = new paragraph
// (No imports, so it works in the browser, the server and the tests.)

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function inline(s: string, linkStyle: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, text, url) => `<a href="${url}"${linkStyle ? ` style="${linkStyle}"` : ""}>${text}</a>`);
}

/** Turn simple marked-up text into HTML. `email` adds inline styles for email clients. */
export function renderMarkdown(text: string, { email = false } = {}) {
  const link = email ? "color:#c25b78" : "";
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .map((b) => {
      const lines = b.split("\n");
      if (/^#{1,3} /.test(lines[0]) && lines.length === 1) {
        const t = inline(lines[0].replace(/^#{1,3} /, ""), link);
        return email ? `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:21px;margin:18px 0 6px">${t}</h2>` : `<h2>${t}</h2>`;
      }
      if (lines.every((l) => /^[-*] /.test(l))) return `<ul${email ? ' style="padding-left:20px"' : ""}>${lines.map((l) => `<li>${inline(l.slice(2), link)}</li>`).join("")}</ul>`;
      return `<p>${lines.map((l) => inline(l, link)).join("<br>")}</p>`;
    })
    .join("\n");
}

/** Plain text preview (for summaries and the journal list) */
export const plainText = (text: string) => text.replace(/^#{1,3} /gm, "").replace(/\*\*|\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/^[-*] /gm, "• ").trim();
