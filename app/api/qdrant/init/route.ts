
export async function GET() {
  const response = {
    results: [
      { collection: "transactions", status: "exists" },
      { collection: "accounts", status: "exists" },
      { collection: "tokens", status: "exists" },
      { collection: "programs", status: "exists" },
      { collection: "relationships", status: "exists" }
    ]
  };
  
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
