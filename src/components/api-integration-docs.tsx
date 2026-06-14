import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";

function MethodBadge({ method }: { method: "GET" | "POST" | "DELETE" | "PATCH" }) {
  const colors = {
    GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
    POST: "bg-blue-100 text-blue-700 border-blue-200",
    DELETE: "bg-red-100 text-red-700 border-red-200",
    PATCH: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold font-mono", colors[method])}>
      {method}
    </span>
  );
}

function Endpoint({ method, path, description }: { method: "GET" | "POST" | "DELETE" | "PATCH"; path: string; description: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <MethodBadge method={method} />
      <div className="min-w-0">
        <code className="text-sm font-mono text-slate-800">{path}</code>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-slate-900 rounded-lg p-4 pr-20 overflow-x-auto text-xs font-mono leading-relaxed">
        <code className="text-slate-100">{code}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-20">
      <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2">{title}</h3>
      {children}
    </section>
  );
}

function ParamRow({ name, type, required, description }: { name: string; type: string; required?: boolean; description: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 w-48 flex-shrink-0">
        <code className="text-xs font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{name}</code>
        {required && <span className="text-xs text-red-500 font-medium">required</span>}
      </div>
      <span className="text-xs text-slate-400 font-mono w-16 flex-shrink-0 pt-0.5">{type}</span>
      <span className="text-sm text-slate-600">{description}</span>
    </div>
  );
}

export function ApiIntegrationDocs() {
  return (
    <div className="max-w-3xl space-y-10">

      {/* Overview */}
      <Section id="overview" title="Overview">
        <p className="text-sm text-slate-600 leading-relaxed">
          The Content API lets you fetch your CMS data from any external application —
          a portfolio site, a web app, a mobile app, or a static site generator.
          All endpoints are public and protected by API keys that you manage from each project&apos;s settings.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">Base URL</p>
            <code className="text-sm font-mono text-slate-800">https://your-domain.com/api/v1</code>
          </div>
          <div className="[&_button]:bg-slate-200 [&_button]:text-slate-600 [&_button:hover]:bg-slate-300 [&_button:hover]:text-slate-800">
            <CopyButton text="https://your-domain.com/api/v1" />
          </div>
        </div>
      </Section>

      {/* Authentication */}
      <Section id="authentication" title="Authentication">
        <p className="text-sm text-slate-600">
          Every request must include an API key in the <code className="text-xs bg-slate-100 px-1 rounded font-mono">Authorization</code> header.
          API keys in the URL query string are not supported and will return a <code className="text-xs bg-slate-100 px-1 rounded font-mono">400</code> error.
        </p>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Authorization header</p>
          <CodeBlock code={`GET /api/v1/projects
Authorization: Bearer cms_your_api_key_here`} language="http" />
        </div>
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-600 text-sm mt-0.5">⚠</span>
          <p className="text-sm text-amber-800">
            Keep your API key secret. Never expose it in client-side code or public repositories.
            For browser-based apps, proxy requests through your own backend and store the key in an environment variable.
          </p>
        </div>
      </Section>

      {/* Endpoints */}
      <Section id="endpoints" title="Endpoints">
        <div className="border border-slate-200 rounded-lg px-4 divide-y divide-slate-100">
          <Endpoint method="GET" path="/api/v1/projects" description="List all projects for your account" />
          <Endpoint method="GET" path="/api/v1/{projectSlug}" description="Get a single project with its category list" />
          <Endpoint method="GET" path="/api/v1/{projectSlug}/{categorySlug}" description="Get all entries in a category, with relation fields expanded" />
        </div>
      </Section>

      {/* GET /api/v1/projects */}
      <Section id="get-projects" title="GET /api/v1/projects">
        <p className="text-sm text-slate-600">
          Returns all non-archived projects associated with your API key&apos;s account, ordered by last updated.
        </p>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Query parameters</p>
          <div className="border border-slate-200 rounded-lg px-4">
            <ParamRow name="page" type="number" description="Page number, starting at 1 (default: 1)" />
            <ParamRow name="limit" type="number" description="Results per page, max 100 (default: 20)" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Response</p>
          <CodeBlock code={`{
  "projects": [
    {
      "id": "clx...",
      "name": "My Portfolio",
      "slug": "my-portfolio",
      "status": "live",
      "overview": "A personal portfolio site...",
      "tagline": "Personal portfolio",
      "industry": "Technology",
      "role": "Lead Developer",
      "teamSize": "3",
      "techStack": [
        { "icon": "https://cdn.example.com/react.svg", "name": "React" },
        { "icon": "⚡", "name": "Next.js" }
      ],
      "highlights": ["Built with App Router", "100 Lighthouse score"],
      "featured": true,
      "liveUrl": "https://example.com",
      "githubUrl": "https://github.com/you/project",
      "thumbnail_image": "https://storage.googleapis.com/...",
      "thumbnail_alt": "Screenshot of the app",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": null
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}`} />
        </div>
      </Section>

      {/* GET /api/v1/{projectSlug} */}
      <Section id="get-project" title="GET /api/v1/{projectSlug}">
        <p className="text-sm text-slate-600">
          Returns project metadata and a list of its content categories. Use this to display a project detail page or to discover which categories are available.
        </p>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Path parameters</p>
          <div className="border border-slate-200 rounded-lg px-4">
            <ParamRow name="projectSlug" type="string" required description="The slug of the project (found on the project detail page)" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Response</p>
          <CodeBlock code={`{
  "project": {
    "name": "My Portfolio",
    "slug": "my-portfolio",
    "status": "live",
    "overview": "...",
    "tagline": "...",
    "industry": "Technology",
    "techStack": [...]
  },
  "categories": [
    {
      "name": "Blog Posts",
      "slug": "blog-posts",
      "description": "Articles and writings",
      "fields": [
        { "name": "title", "type": "text" },
        { "name": "body", "type": "rich_text" },
        { "name": "author", "type": "relation" },
        { "name": "publishedAt", "type": "date" }
      ],
      "entryCount": 12
    }
  ]
}`} />
        </div>
      </Section>

      {/* GET /api/v1/{projectSlug}/{categorySlug} */}
      <Section id="get-category" title="GET /api/v1/{projectSlug}/{categorySlug}">
        <p className="text-sm text-slate-600">
          Returns all non-archived entries in a category, sorted by their sort order.
          Each entry&apos;s fields are spread at the top level for easy access.
          Relation fields are automatically expanded — the raw entry ID is replaced with the full referenced entry&apos;s fields.
        </p>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Path parameters</p>
          <div className="border border-slate-200 rounded-lg px-4">
            <ParamRow name="projectSlug" type="string" required description="The slug of the project" />
            <ParamRow name="categorySlug" type="string" required description="The slug of the content category" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Query parameters</p>
          <div className="border border-slate-200 rounded-lg px-4">
            <ParamRow name="page" type="number" description="Page number, starting at 1 (default: 1)" />
            <ParamRow name="limit" type="number" description="Results per page, max 100 (default: 20)" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Response</p>
          <CodeBlock code={`{
  "category": {
    "name": "Blog Posts",
    "slug": "blog-posts",
    "description": "Articles and writings",
    "fields": [
      { "name": "title", "type": "text" },
      { "name": "body", "type": "rich_text" },
      { "name": "author", "type": "relation" }
    ]
  },
  "data": [
    {
      "id": "clx...",
      "title": "Hello World",
      "body": "<p>My first post...</p>",
      "author": {
        "id": "clx...",
        "name": "Jane Smith",
        "role": "Editor"
      }
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}`} />
        </div>
        <div className="flex items-start gap-2.5 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-indigo-500 text-sm mt-0.5">ℹ</span>
          <p className="text-sm text-indigo-800">
            <strong>Relation fields</strong> are resolved automatically. If an entry has a field of type <code className="text-xs bg-indigo-100 px-1 rounded font-mono">relation</code>, its value in the response will be the full referenced entry object rather than a raw ID string.
          </p>
        </div>
      </Section>

      {/* Field types */}
      <Section id="field-types" title="Field Types">
        <p className="text-sm text-slate-600">
          The <code className="text-xs bg-slate-100 px-1 rounded font-mono">fields</code> array on each category describes the shape of its entries.
        </p>
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {[
            { type: "text", desc: "Short plain text" },
            { type: "textarea", desc: "Multi-line plain text" },
            { type: "rich_text", desc: "HTML string from the rich text editor" },
            { type: "number", desc: "Numeric value (returned as a string)" },
            { type: "date", desc: "ISO 8601 date string (e.g. 2024-06-01)" },
            { type: "boolean", desc: 'String "true" or "false"' },
            { type: "url", desc: "URL string" },
            { type: "email", desc: "Email address string" },
            { type: "enum", desc: "One of the predefined option values" },
            { type: "relation", desc: "Expanded to the full referenced entry object (see above)" },
          ].map(({ type, desc }) => (
            <div key={type} className="flex items-start gap-3 px-4 py-2.5">
              <code className="text-xs font-mono text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded w-24 flex-shrink-0">{type}</code>
              <span className="text-sm text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Error responses */}
      <Section id="errors" title="Error Responses">
        <p className="text-sm text-slate-600">All errors return a JSON object with an <code className="text-xs bg-slate-100 px-1 rounded font-mono">error</code> field.</p>
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {[
            { code: "400", label: "Bad Request", desc: 'API key passed as a query parameter (?key=...) — use the Authorization header instead' },
            { code: "401", label: "Unauthorized", desc: "No API key provided, or the key is invalid, expired, or revoked" },
            { code: "404", label: "Not Found", desc: "The project or category slug does not exist or is archived" },
            { code: "429", label: "Too Many Requests", desc: "Rate limit exceeded — slow down requests" },
            { code: "500", label: "Server Error", desc: "An internal error occurred" },
          ].map(({ code, label, desc }) => (
            <div key={code} className="flex items-start gap-3 px-4 py-3">
              <span className="text-xs font-bold font-mono text-slate-500 w-10 flex-shrink-0 pt-0.5">{code}</span>
              <span className="text-sm font-medium text-slate-800 w-32 flex-shrink-0">{label}</span>
              <span className="text-sm text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
        <CodeBlock code={`{ "error": "Invalid API key" }`} />
      </Section>

      {/* Code Examples */}
      <Section id="examples" title="Code Examples">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">JavaScript (fetch)</p>
            <CodeBlock language="js" code={`const API_KEY = process.env.CMS_API_KEY;
const BASE = "https://your-domain.com/api/v1";

// Fetch all projects
const { projects } = await fetch(\`\${BASE}/projects\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());

// Fetch entries in a category (with pagination)
const { data, pagination } = await fetch(
  \`\${BASE}/my-project/blog-posts?page=1&limit=10\`,
  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
).then((r) => r.json());`} />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Next.js — Server Component</p>
            <CodeBlock language="tsx" code={`// app/blog/page.tsx
const API_KEY = process.env.CMS_API_KEY!;
const BASE = process.env.CMS_BASE_URL!; // https://your-domain.com/api/v1

export default async function BlogPage() {
  const res = await fetch(\`\${BASE}/my-project/blog-posts\`, {
    headers: { Authorization: \`Bearer \${API_KEY}\` },
    next: { revalidate: 60 }, // ISR — refresh every 60 seconds
  });
  const { data: posts } = await res.json();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <a href={\`/blog/\${post.slug}\`}>{post.title}</a>
          {/* relation field is already expanded */}
          <p>By {post.author?.name}</p>
        </li>
      ))}
    </ul>
  );
}`} />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Environment variables</p>
            <CodeBlock language="sh" code={`# .env.local (never commit this file)
CMS_API_KEY=cms_your_api_key_here
CMS_BASE_URL=https://your-domain.com/api/v1`} />
          </div>
        </div>
      </Section>

      {/* CORS */}
      <Section id="cors" title="CORS">
        <p className="text-sm text-slate-600">
          All <code className="text-xs bg-slate-100 px-1 rounded font-mono">/api/v1/</code> endpoints include the following CORS headers,
          so they can be called directly from a browser if needed:
        </p>
        <CodeBlock code={`Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type`} />
        <p className="text-sm text-slate-600">
          Calling the API directly from a browser exposes your API key in network requests.
          For production, prefer server-side fetching and store the key in an environment variable.
        </p>
      </Section>

    </div>
  );
}
