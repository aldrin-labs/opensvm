import React from 'react';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="py-8">
        <div className="container mx-auto">
          <div className="bg-card shadow-md rounded-lg overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}