import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Book, Database, FileText, Code, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface DocFile {
  name: string;
  path: string;
  title: string;
}

interface DocListResponse {
  files: DocFile[];
}

const docIconMap: Record<string, typeof Book> = {
  'DATA_COLLECTION.md': Database,
  'ARCHITECTURE.md': Code,
  'index.md': FileText,
};

function getDocIcon(filename: string) {
  return docIconMap[filename] || FileText;
}

function getDocTitle(filename: string): string {
  const titles: Record<string, string> = {
    'DATA_COLLECTION.md': 'Data Collection Guide',
    'ARCHITECTURE.md': 'System Architecture',
    'index.md': 'Documentation Index',
  };
  return titles[filename] || filename.replace('.md', '').replace(/_/g, ' ');
}

export default function Documentation() {
  const [activeDoc, setActiveDoc] = useState<string>('DATA_COLLECTION.md');

  const { data: docList, isLoading: listLoading } = useQuery<DocListResponse>({
    queryKey: ['/api/docs'],
  });

  const { data: docContent, isLoading: contentLoading } = useQuery<string>({
    queryKey: ['/docs', activeDoc],
    queryFn: async () => {
      const response = await fetch(`/docs/${activeDoc}`);
      if (!response.ok) {
        throw new Error('Failed to fetch documentation');
      }
      return response.text();
    },
    enabled: !!activeDoc,
  });

  const files = docList?.files || [];
  
  const renderMarkdown = (content: string): string => {
    const rawHtml = marked(content, {
      gfm: true,
      breaks: true,
    }) as string;
    
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'pre', 'code',
        'blockquote',
        'strong', 'em', 'b', 'i', 'u',
        'a', 'span', 'div',
      ],
      ALLOWED_ATTR: ['href', 'class', 'id', 'target', 'rel'],
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Book className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-semibold">Documentation Library</h1>
          <Badge variant="outline" className="text-xs">v1.0.0</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Reference guides for data collection, architecture, and methodology
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-border p-4 flex-shrink-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Documents
          </div>
          
          {listLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <nav className="space-y-1">
              {files.map((file) => {
                const Icon = getDocIcon(file.name);
                const isActive = activeDoc === file.name;
                return (
                  <button
                    key={file.name}
                    onClick={() => setActiveDoc(file.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    data-testid={`button-doc-${file.name.replace('.md', '')}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate">{getDocTitle(file.name)}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Quick Stats
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Region</span>
                <span className="text-foreground">British Columbia</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chambers</span>
                <span className="text-cyan-400">107</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="text-foreground">1.0.0</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Raw Files
            </div>
            {files.map((file) => (
              <a
                key={file.name}
                href={file.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-cyan-400 transition-colors mt-2"
                data-testid={`link-raw-${file.name.replace('.md', '')}`}
              >
                <FileText className="w-4 h-4" />
                <span className="truncate">{file.name}</span>
                <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto p-6">
              {contentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span className="ml-2 text-muted-foreground">Loading documentation...</span>
                </div>
              ) : docContent ? (
                <article 
                  className="prose prose-invert prose-cyan max-w-none
                    prose-headings:text-foreground prose-headings:font-semibold
                    prose-h1:text-2xl prose-h1:text-cyan-400 prose-h1:border-b prose-h1:border-border prose-h1:pb-2
                    prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-2
                    prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
                    prose-p:text-muted-foreground prose-p:leading-relaxed
                    prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-foreground prose-strong:font-semibold
                    prose-code:text-cyan-400 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                    prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border prose-pre:rounded-md
                    prose-table:border prose-table:border-border prose-table:rounded-md
                    prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-th:text-muted-foreground prose-th:uppercase prose-th:tracking-wider
                    prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-border/50
                    prose-tr:hover:bg-muted/30
                    prose-blockquote:border-l-2 prose-blockquote:border-cyan-500/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
                    prose-hr:border-border
                    prose-li:text-muted-foreground prose-li:marker:text-cyan-400"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(docContent) }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select a document from the sidebar to view
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
