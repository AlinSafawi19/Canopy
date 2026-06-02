"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

// Preserve HTML attributes that TipTap strips by default (e.g. dir="auto",
// data-* on list items) so imported HTML round-trips through the editor intact.
const PreserveAttributes = Extension.create({
  name: "preserveAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock"],
        attributes: {
          dir: {
            default: null,
            parseHTML: (el) => el.getAttribute("dir") || null,
            renderHTML: (attrs) => (attrs.dir ? { dir: attrs.dir } : {}),
          },
        },
      },
      {
        types: ["listItem"],
        attributes: {
          "data-preset-tag": {
            default: null,
            parseHTML: (el) => el.getAttribute("data-preset-tag") || null,
            renderHTML: (attrs) =>
              attrs["data-preset-tag"] ? { "data-preset-tag": attrs["data-preset-tag"] } : {},
          },
        },
      },
    ];
  },
});
import {
  Bold, Italic, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus, ImageIcon, Upload, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}

// ── Image insert popover ───────────────────────────────────────────────────────

function ImagePopover({
  onInsert,
  onClose,
}: {
  onInsert: (src: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click — delay registration so the opening click doesn't immediately close it
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const id = setTimeout(() => document.addEventListener("mousedown", handle), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handle);
    };
  }, [onClose]);

  function handleInsertUrl() {
    const trimmed = url.trim();
    if (trimmed) { onInsert(trimmed); onClose(); }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) { onInsert(src); onClose(); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-3 space-y-3"
    >
      {/* Tabs */}
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setTab("url")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors",
            tab === "url" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <Link2 size={11} /> URL
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors",
            tab === "upload" ? "bg-indigo-100 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <Upload size={11} /> Upload
        </button>
      </div>

      {tab === "url" ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInsertUrl(); } }}
            placeholder="https://example.com/image.png"
            className="flex-1 text-xs border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="button"
            disabled={!url.trim()}
            onClick={handleInsertUrl}
            className="px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Insert
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-1.5 border-2 border-dashed border-slate-300 rounded-lg py-4 px-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
          <Upload size={16} className="text-slate-400" />
          <span className="text-xs text-slate-600 font-medium">Click to choose image</span>
          <span className="text-[11px] text-slate-400">PNG, JPG, GIF, WebP</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

// ── Editor ─────────────────────────────────────────────────────────────────────

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = "Write something…",
  minHeight = "120px",
}: RichTextEditorProps) {
  const [imgPopoverOpen, setImgPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit defaults to [1,2,3] — allow all six levels so h4/h5/h6
        // imported from external HTML are preserved instead of stripped.
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      PreserveAttributes,
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full rounded-lg my-2 border border-slate-200",
        },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "text-sm text-slate-900 px-3 py-2.5",
        style: `min-height: ${minHeight}`,
        "data-placeholder": placeholder,
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  function insertImage(src: string) {
    editor?.chain().focus().setImage({ src }).run();
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className="rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic size={13} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
            <Heading3 size={13} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
            <List size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered list">
            <ListOrdered size={13} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
            <Quote size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
            <Code size={13} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider">
            <Minus size={13} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          {/* Image button with popover */}
          <div className="relative">
            <button
              type="button"
              title="Insert image"
              onClick={() => setImgPopoverOpen((v) => !v)}
              className={cn(
                "p-1.5 rounded transition-colors",
                imgPopoverOpen
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
            >
              <ImageIcon size={13} />
            </button>
            {imgPopoverOpen && (
              <ImagePopover
                onInsert={insertImage}
                onClose={() => setImgPopoverOpen(false)}
              />
            )}
          </div>
        </div>
        {/* Editor */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
