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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-slate-600 dark:text-slate-400 text-lg font-medium">Loading documentation...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-10 bg-white dark:bg-slate-800 rounded-2xl border-2 border-red-200 dark:border-red-900 shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-slate-900 dark:text-slate-100">Documentation Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">The requested documentation page could not be found.</p>
          <Link 
            href="/docs" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documentation
          </Link>
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
        <div className="border-b-2 border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-5">
            <Link 
              href="/docs" 
              className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Documentation
            </Link>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-md">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">Documentation</span>
                <span className="text-slate-400 dark:text-slate-500">/</span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold">{slug.replace(/-/g, ' ').replace(/_/g, ' ')}</span>
              </div>
            </div>
            
            <article className="prose prose-lg max-w-none bg-white dark:bg-slate-800 rounded-2xl p-10 border-2 border-slate-200 dark:border-slate-700 shadow-xl
              prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-headings:scroll-mt-20
              prose-h1:text-5xl prose-h1:font-bold prose-h1:mb-8 prose-h1:bg-gradient-to-r prose-h1:from-blue-600 prose-h1:via-purple-600 prose-h1:to-pink-600 dark:prose-h1:from-blue-400 dark:prose-h1:via-purple-400 dark:prose-h1:to-pink-400 prose-h1:bg-clip-text prose-h1:text-transparent
              prose-h2:text-3xl prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b-2 prose-h2:border-slate-200 dark:prose-h2:border-slate-700 prose-h2:pb-4 prose-h2:text-slate-900 dark:prose-h2:text-slate-100
              prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-slate-900 dark:prose-h3:text-slate-100
              prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:text-base prose-p:leading-8 prose-p:mb-6
              prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-bold
              prose-em:text-slate-700 dark:prose-em:text-slate-300
              prose-code:bg-slate-100 dark:prose-code:bg-slate-900 prose-code:text-slate-900 dark:prose-code:text-slate-100 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-code:border prose-code:border-slate-200 dark:prose-code:border-slate-700
              prose-pre:bg-slate-950 dark:prose-pre:bg-black prose-pre:text-slate-100 prose-pre:border-2 prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:p-6 prose-pre:shadow-inner prose-pre:overflow-x-auto
              prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
              prose-ol:text-slate-700 dark:prose-ol:text-slate-300 prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
              prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:my-2 prose-li:leading-7
              prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-slate-900/50 prose-blockquote:border-l-4 prose-blockquote:border-blue-600 dark:prose-blockquote:border-blue-400 prose-blockquote:pl-6 prose-blockquote:py-4 prose-blockquote:italic prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300 prose-blockquote:rounded-r-lg
              prose-img:rounded-xl prose-img:shadow-2xl prose-img:border-2 prose-img:border-slate-200 dark:prose-img:border-slate-700
              prose-table:border-2 prose-table:border-slate-200 dark:prose-table:border-slate-700 prose-table:rounded-xl prose-table:bg-white dark:prose-table:bg-slate-900 prose-table:shadow-lg prose-table:overflow-hidden
              prose-thead:bg-slate-100 dark:prose-thead:bg-slate-800 prose-thead:text-slate-900 dark:prose-thead:text-slate-100
              prose-tbody:text-slate-700 dark:prose-tbody:text-slate-300
              prose-th:p-4 prose-th:border prose-th:border-slate-200 dark:prose-th:border-slate-700 prose-th:font-bold prose-th:text-slate-900 dark:prose-th:text-slate-100
              prose-td:p-4 prose-td:border prose-td:border-slate-200 dark:prose-td:border-slate-700 prose-td:text-slate-700 dark:prose-td:text-slate-300
            ">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const content = String(children).replace(/\n$/, '');
                    
                    // Render Mermaid diagrams
                    if (language === 'mermaid') {
                      return <Mermaid chart={content} />;
                    }
                    
                    // Regular code blocks
                    if (match) {
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
            <div className="mt-10 pt-8 border-t-2 border-slate-200 dark:border-slate-700">
              <Link 
                href="/docs"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to all documentation
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
