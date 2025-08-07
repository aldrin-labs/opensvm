export const dynamic = 'force-dynamic';

import { promises as fs } from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const title = resolvedParams.slug.replace(/-/g, ' ');
  return {
    title: `${title} - OpenSVM Documentation`,
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <a href="/docs" className="text-blue-500 hover:underline">← Back to Documentation</a>
        </div>
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    );
  } catch (error) {
    console.error(`Error reading doc file: ${filePath}`, error);
    notFound();
  }
}
