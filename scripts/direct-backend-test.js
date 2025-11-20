async function analyzeAccount() {
  const account = "AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6";
  const question = `Analyze the account ${account}. Provide insights on its activity, transactions, and any notable patterns.`;

  console.log(`\nAnalyzing account: "${account}"`);
  try {
    const response = await fetch('http://localhost:3000/api/getAnswer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sources: [] })
    });

    if (response.ok) {
      const answer = await response.text();
      console.log("AI Response:", answer);
    } else {
      console.error("Error:", response.status, response.statusText);
      const errorText = await response.text();
      console.error("Error details:", errorText);
    }
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

analyzeAccount();
