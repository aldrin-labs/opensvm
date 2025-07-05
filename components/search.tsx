'use client';

export default function EnhancedSearchBar() {
  return (
    <div className="w-full">
      <input
        type="text"
        placeholder="Search for transactions, accounts, blocks..."
        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </div>
  );
}