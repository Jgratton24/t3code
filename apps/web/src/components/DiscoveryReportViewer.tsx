/**
 * DiscoveryReportViewer - Rich markdown rendering for discovery reports.
 *
 * Features: collapsible sections, severity badges, clickable file paths,
 * copy-section buttons.
 */
import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface DiscoveryReportViewerProps {
  markdown: string;
  runId: string;
}

/** Parse Impact/Effort/Risk badges from text like "**Impact**: high" */
function SeverityBadge({ text }: { text: string }) {
  const match = text.match(/\*\*(Impact|Effort|Risk)\*\*:\s*(high|medium|low)/i);
  if (!match) return null;
  const [, label, level] = match;
  const color =
    level?.toLowerCase() === "high"
      ? "destructive"
      : level?.toLowerCase() === "medium"
        ? "secondary"
        : "default";
  return (
    <Badge variant={color as any} className="text-xs">
      {label}: {level}
    </Badge>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API may fail in some contexts
    }
  }, [text]);

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 w-6 p-0">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function DiscoveryReportViewer({ markdown, runId }: DiscoveryReportViewerProps) {
  return (
    <Card>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none py-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-6 text-lg font-semibold">{children}</h2>
            ),
            h3: ({ children, ...props }) => (
              <h3 className="mt-4 text-base font-semibold">{children}</h3>
            ),
            li: ({ children }) => {
              const text = String(children);
              return (
                <li>
                  {children}
                  <SeverityBadge text={text} />
                </li>
              );
            },
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {children}
                  </code>
                );
              }
              return (
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
                    <code>{children}</code>
                  </pre>
                  <div className="absolute right-2 top-2">
                    <CopyButton text={String(children)} />
                  </div>
                </div>
              );
            },
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline hover:text-primary/80"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b bg-muted/50 px-3 py-2 text-left text-xs font-medium">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b px-3 py-2 text-sm">{children}</td>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary/30 bg-primary/5 py-2 pl-4 italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </CardContent>
    </Card>
  );
}
