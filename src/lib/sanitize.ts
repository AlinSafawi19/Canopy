import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "ul", "ol", "li",
  "h2", "h3",
  "strong", "em",
  "blockquote", "code",
];

export function sanitizeReleaseNotes(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}
