import { promises as fs } from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const title = resolvedParams.slug.replace(/-/g, ' ').replace(/_/g, ' ');
  return {
    title: `${title} - OpenSVM Documentation`,
    description: `Documentation for ${title} in OpenSVM blockchain explorer`,
  };
}

export default async function DocPage({ params }: Props) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;
  
  // Use path.join with process.cwd() to get the correct path in both dev and prod
  const docsDir = path.join(process.cwd(), 'docs');
  const filePath = path.join(docsDir, `${slug}.md`);

  try {
    // Verify directory exists
    try {
      await fs.access(docsDir);
    } catch (error) {
      console.error(`Docs directory not found: ${docsDir}`);
      notFound();
    }

    const content = await fs.readFile(filePath, 'utf8');

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
            
            <article className="prose prose-lg dark:prose-invert max-w-none
              prose-headings:scroll-mt-20
              prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-6
              prose-h2:text-3xl prose-h2:font-semibold prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2
              prose-h3:text-2xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-base prose-p:leading-7 prose-p:mb-4
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg prose-pre:p-4
              prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
              prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
              prose-li:my-2
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
              prose-img:rounded-lg prose-img:shadow-lg
              prose-table:border prose-table:rounded-lg
              prose-thead:bg-muted
              prose-th:p-3 prose-th:border prose-th:font-semibold
              prose-td:p-3 prose-td:border
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
  } catch (error) {
    console.error(`Error reading doc file: ${filePath}`, error);
    notFound();
  }
}
