export const dynamic = 'force-dynamic'

export default function BlocksPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Recent Blocks</h1>
        <p className="text-muted-foreground">
          View latest blocks and transactions on the Solana network.
        </p>
      </div>
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Block explorer coming soon...</p>
      </div>
    </div>
  );
}
