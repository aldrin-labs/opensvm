'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import mermaid from 'mermaid';

// Mermaid component for rendering diagrams
const Mermaid = ({ chart }: { chart: string }) => {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
    });
    mermaid.contentLoaded();
  }, [chart]);

  return (
    <div className="mermaid my-8 flex justify-center">
      {chart}
    </div>
  );
};

export default function DocPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        // Fetch from public folder
        const response = await fetch(`/${slug}.md`);
        if (!response.ok) {
          setError(true);
          return;
        }
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error fetching doc:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchDoc();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading documentation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Documentation Not Found</h1>
          <Link href="/docs" className="text-primary hover:underline">
            Back to Documentation
          </Link>
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <Link 
              href="/docs" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Documentation
            </Link>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <FileText className="w-4 h-4" />
                <span>Documentation</span>
                <span>/</span>
                <span className="text-foreground">{slug.replace(/-/g, ' ').replace(/_/g, ' ')}</span>
              </div>
            </div>
            
            <article className="prose prose-lg max-w-none
              prose-headings:text-foreground prose-headings:scroll-mt-20
              prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-6
              prose-h2:text-3xl prose-h2:font-semibold prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border prose-h2:pb-2
              prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-foreground prose-p:text-base prose-p:leading-7 prose-p:mb-4
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-semibold
              prose-em:text-foreground
              prose-code:bg-muted prose-code:text-foreground prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4
              prose-ul:text-foreground prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
              prose-ol:text-foreground prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
              prose-li:text-foreground prose-li:my-2
              prose-blockquote:bg-muted/50 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-muted-foreground
              prose-img:rounded-lg prose-img:shadow-lg
              prose-table:border prose-table:border-border prose-table:rounded-lg prose-table:bg-card
              prose-thead:bg-muted prose-thead:text-foreground
              prose-tbody:text-foreground
              prose-th:p-3 prose-th:border prose-th:border-border prose-th:font-semibold prose-th:text-foreground
              prose-td:p-3 prose-td:border prose-td:border-border prose-td:text-foreground
            ">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const content = String(children).replace(/\n$/, '');
                    
                    // Render Mermaid diagrams
                    if (language === 'mermaid') {
                      return <Mermaid chart={content} />;
                    }
                    
                    // Regular code blocks
                    if (!inline && match) {
                      return (
                        <pre className={className}>
                          <code {...props} className={className}>
                            {children}
                          </code>
                        </pre>
                      );
                    }
                    
                    // Inline code
                    return <code {...props} className={className}>{children}</code>;
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
            
            {/* Table of Contents could go here */}
            <div className="mt-12 pt-8 border-t">
              <Link 
                href="/docs"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to all documentation
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
