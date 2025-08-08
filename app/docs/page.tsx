export const dynamic = 'force-dynamic';

import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '@/lib/settings';

export const metadata = {
  title: 'OpenSVM Documentation',
};

export default function DocsPage() {  const docsDir = path.join(process.cwd(), 'docs');
  const settings = useSettings();

  try {
    // Verify directory exists
    try {
      fs.access(docsDir);
    } catch (error) {
      console.error(`Docs directory not found: ${docsDir}`);
      return (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Documentation</h1>
          <p className="text-red-500">Documentation directory not found. Please ensure all documentation files are properly installed.</p>
        </div>
      );
    }

    const files = fs.readdir(docsDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    // Get the content of index.md if it exists
    let indexContent = null;
    if (mdFiles.includes('index.md')) {
      const indexPath = path.join(docsDir, 'index.md');
      indexContent = fs.readFile(indexPath, 'utf8');
    }

    if (mdFiles.length === 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Documentation</h1>
          <p>No documentation files found.</p>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">OpenSVM Documentation</h1>
        
        {indexContent && (
          <div className="prose dark:prose-invert max-w-none mb-8">
            <ReactMarkdown>{indexContent}</ReactMarkdown>
          </div>
        )}
        
        <h2 className="text-2xl font-bold mb-4">Documentation Pages</h2>
        <div className="grid gap-4">
          {mdFiles
            .filter(file => file !== 'index.md')
            .map((file) => (
              <Link 
                key={file}
                href={`/docs/${encodeURIComponent(file.replace('.md', ''))}`}
                className="p-4 border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {file.replace('.md', '').replace(/-/g, ' ')}
              </Link>
            ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading documentation:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Documentation</h1>
        <p className="text-red-500">Error loading documentation. Please try again later.</p>
      </div>
    );
  }
}