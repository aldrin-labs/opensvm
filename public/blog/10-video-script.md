# Video Script: OpenSVM MCP Platform Demo

**Duration:** 3-5 minutes
**Format:** Screen recording with voiceover
**Software:** OBS Studio / Loom / Screen Studio

---

## Scene 1: Hook (0:00 - 0:15)

**[Screen: Terminal with "OpenSVM MCP" ASCII art]**

**Voiceover:**
> "What if your AI assistant could explore the Solana blockchain in real-time? Today I'll show you how we made that possible with the OpenSVM MCP Platform."

---

## Scene 2: The Setup (0:15 - 0:45)

**[Screen: Claude Desktop config file]**

**Voiceover:**
> "Setup takes 30 seconds. Open your Claude Desktop config, add these three lines..."

**[Type the config]**
```json
{
  "mcpServers": {
    "opensvm": {
      "command": "bun",
      "args": ["run", "/path/to/opensvm-mcp.ts"]
    }
  }
}
```

> "Save, restart Claude, and you now have 100+ blockchain tools at your fingertips."

---

## Scene 3: Basic Query (0:45 - 1:30)

**[Screen: Claude Desktop chat]**

**Voiceover:**
> "Let's start simple. I'll ask Claude to look up a transaction."

**[Type in Claude]**
> "What happened in this Solana transaction? [paste signature]"

**[Show Claude calling the tool, receiving response]**

> "Claude automatically calls our `solana:get_transaction` tool, parses the result, and explains it in plain English. No API keys, no code - just a question."

---

## Scene 4: Account Investigation (1:30 - 2:30)

**[Screen: Claude Desktop]**

**Voiceover:**
> "Now let's try something more complex. I found a wallet that looks suspicious."

**[Type in Claude]**
> "Investigate this Solana address for unusual activity: [paste whale address]"

**[Show the multi-step process]**

> "Watch what happens. Claude is now:
> 1. Fetching account info
> 2. Pulling transaction history
> 3. Analyzing token flows
> 4. Checking for known patterns
>
> This would take a developer hours to code. Claude does it in seconds."

**[Show the final report]**

> "And here's the report - complete with findings, risk assessment, and related addresses to investigate."

---

## Scene 5: Real-Time Streaming (2:30 - 3:30)

**[Screen: Split - Claude Desktop + Terminal showing stream]**

**Voiceover:**
> "But here's where it gets really interesting - real-time streaming."

**[Type in Claude]**
> "Stream the next 50 transactions for this DeFi protocol and summarize them"

**[Show SSE events flowing in terminal]**

> "Our MCP server is now pushing live blockchain data to Claude. Each transaction streams in real-time via Server-Sent Events."

**[Show Claude summarizing]**

> "And Claude processes them as they arrive, building a live summary of what's happening on-chain right now."

---

## Scene 6: Checkpoint Recovery (3:30 - 4:00)

**[Screen: Terminal showing checkpoint save]**

**Voiceover:**
> "What happens if the stream disconnects? We built resumable checkpoints."

**[Simulate disconnect, show checkpoint in logs]**

> "The position is saved. When you reconnect..."

**[Show resume]**

> "...it picks up exactly where it left off. No lost data, no duplicate processing."

---

## Scene 7: The Bigger Picture (4:00 - 4:30)

**[Screen: Architecture diagram from blog post]**

**Voiceover:**
> "Under the hood, this is a full MCP implementation:
> - WebSocket and SSE transports
> - Resumable streams with Qdrant-backed checkpoints
> - A federation of specialized servers
> - 515 tests ensuring reliability
>
> It's production infrastructure, open source, ready to use."

---

## Scene 8: Call to Action (4:30 - 5:00)

**[Screen: GitHub repo + blog post]**

**Voiceover:**
> "Everything you saw is available now:
> - Full source code on GitHub
> - Setup guide in our blog post
> - Join our Discord to share what you build
>
> The future of blockchain is AI-native. Let's build it together."

**[End card with links]**

---

## B-Roll Suggestions

1. **Transaction flow animation** - Dots moving between nodes
2. **Code scrolling** - The MCP server source
3. **Solana logo** - During blockchain mentions
4. **Claude logo** - During AI mentions
5. **Network graph** - For federation section

---

## Recording Tips

1. **Audio:** Use a good mic, record in quiet room
2. **Resolution:** 1920x1080 minimum, 4K preferred
3. **Font size:** Increase terminal/editor font to 16-18pt
4. **Speed:** Slow down typing, let viewers read
5. **Pauses:** 1-2 second pauses between sections
6. **Clean desktop:** Hide bookmarks, use incognito mode

---

## Thumbnail Options

**Option A:** Claude logo + Solana logo with lightning bolt between
**Option B:** Terminal showing streaming data with "AI + Blockchain" text
**Option C:** Before/after split - "Traditional Explorer" vs "AI Explorer"

---

## Posting Checklist

- [ ] Upload to YouTube
- [ ] Create Twitter video clip (60s version)
- [ ] Post to Farcaster
- [ ] Share in Solana Discord
- [ ] Add to blog post as embed
- [ ] Submit to HackerNews

---

## Timestamps for YouTube Description

```
0:00 - Introduction
0:15 - Quick Setup (30 seconds!)
0:45 - Your First Query
1:30 - Account Investigation Demo
2:30 - Real-Time Streaming
3:30 - Checkpoint Recovery
4:00 - Architecture Overview
4:30 - Get Started
```
