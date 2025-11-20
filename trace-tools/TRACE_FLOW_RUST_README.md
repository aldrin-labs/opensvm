# Trace Flow - Rust Token Transfer Graph Visualizer

A generic Rust implementation for visualizing token transfer graphs with ASCII art diagrams.

## Overview

`trace_flow.rs` is a standalone Rust file that provides a complete system for:
- Building transfer graphs from transaction data
- Finding paths between addresses
- Rendering beautiful ASCII visualizations
- Supporting labels, timestamps, and metadata

## Usage

### Basic Example

```rust
use trace_flow::*;

fn main() {
    let mut graph = TransferGraph::new();
    
    // Set graph metadata
    graph.token_name = Some("SVMAI".to_string());
    graph.origin = Some("OriginAddress123".to_string());
    graph.target = Some("TargetAddress789".to_string());
    
    // Add transfers
    graph.add_transfer(Transfer {
        from: "OriginAddress123".to_string(),
        to: "MiddleAddress456".to_string(),
        amount: 1000000.0,
        token_symbol: "SVMAI".to_string(),
        timestamp: Some("2024-01-01 12:00:00".to_string()),
        note: Some("Initial distribution".to_string()),
    });
    
    graph.add_transfer(Transfer {
        from: "MiddleAddress456".to_string(),
        to: "TargetAddress789".to_string(),
        amount: 500000.0,
        token_symbol: "SVMAI".to_string(),
        timestamp: Some("2024-01-02 14:30:00".to_string()),
        note: None,
    });
    
    // Optional: Set labels for better readability
    graph.set_node_label("OriginAddress123", "Token Mint".to_string());
    graph.set_node_label("MiddleAddress456", "DEX Pool".to_string());
    
    // Render the graph
    println!("{}", graph.render_ascii());
}
```

### Using as a Module

This is a pure Rust module without a main function, designed to be included in your project:

1. **Add to your project:**
   ```bash
   # Copy the file to your project
   cp trace_flow.rs /path/to/your/project/src/
   ```

2. **Include as a module:**
   ```rust
   // In your main.rs or lib.rs
   mod trace_flow;
   use trace_flow::{TransferGraph, Transfer};
   ```

3. **Run tests:**
   ```bash
   cargo test
   # or if using as standalone:
   rustc --test trace_flow.rs && ./trace_flow
   ```

## Data Structures

### Transfer
Represents a single token transfer:
```rust
pub struct Transfer {
    pub from: String,           // Sender address
    pub to: String,             // Receiver address
    pub amount: f64,            // Transfer amount
    pub token_symbol: String,   // Token symbol (e.g., "SVMAI")
    pub timestamp: Option<String>,  // Optional timestamp
    pub note: Option<String>,   // Optional note/label
}
```

### TransferGraph
Main graph structure:
```rust
pub struct TransferGraph {
    pub nodes: HashMap<String, GraphNode>,
    pub origin: Option<String>,     // Starting address
    pub target: Option<String>,     // Target address
    pub token_name: Option<String>, // Token name
    pub token_mint: Option<String>, // Mint address
}
```

## Key Methods

### `add_transfer(transfer: Transfer)`
Adds a transfer to the graph, automatically creating nodes if they don't exist.

### `set_node_label(address: &str, label: String)`
Sets a human-readable label for an address.

### `find_paths(from: &str, to: &str) -> Vec<Vec<String>>`
Finds all paths between two addresses using depth-first search.

### `render_ascii() -> String`
Generates a beautiful ASCII art visualization of the graph.

## Example Output

```
╔══════════════════════════════════════════════════════════════════════════╗
║                     TOKEN DISTRIBUTION TRACE                             ║
╚══════════════════════════════════════════════════════════════════════════╝

TOKEN: SVMAI (Cpzvdx6p...CrcGE77)
TARGET: 5rVDMMoB...dwoX9q85

═══════════════════════════════════════════════════════════════════════════

📊 COMPLETE TOKEN FLOW DIAGRAM:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏦 ORIGIN MINT EQ3iykiT6Jg1...YJxaULAEC
   └─→ [31,151,612.00 SVMAI] (Dec 26, 2024 10:51:22 UTC) [Initial Distribution] ──→ 7q34BaA8vaNn...y72pgNng
      └─→ [21,658,962.00 SVMAI] ──→ BUZZ5JEG9NLQ...Sjd5bMsfsf
         └─→ [16,000,000.00 SVMAI] (Jan 1, 2025 01:05:19) [Direct Path] ──→ 5rVDMMoBQs3z...dwoX9q85

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 PATHS SUMMARY (1 paths found):

🎯 PATH #1: EQ3iykiT → 7q34BaA8 → BUZZ5JEG → 5rVDMMoB

┌─────────────────────────────────────────────────────────────────────────┐
│ Total Nodes:                                                          4 │
│ Total Transfers:                                                      3 │
│ Target Received:                                              16000000.00 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

✅ **Generic Design** - Works with any transfer graph data  
✅ **ASCII Art** - Beautiful Unicode box drawing characters  
✅ **Path Finding** - DFS algorithm to find all paths  
✅ **Address Truncation** - Automatic truncation for readability  
✅ **Flexible Metadata** - Support for timestamps, notes, and labels  
✅ **Zero Dependencies** - Only uses std library  
✅ **Well Tested** - Includes unit tests  

## Integration with JSON Data

To load transfer data from JSON (like `svmai-wallet-graph.json`), you can add serde support:

```rust
// Add to dependencies if using Cargo:
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct JsonTransfer {
    from: String,
    to: String,
    amount: f64,
    token: String,
    timestamp: Option<String>,
}

fn load_from_json(json_path: &str) -> TransferGraph {
    let data = std::fs::read_to_string(json_path).unwrap();
    let transfers: Vec<JsonTransfer> = serde_json::from_str(&data).unwrap();
    
    let mut graph = TransferGraph::new();
    for t in transfers {
        graph.add_transfer(Transfer {
            from: t.from,
            to: t.to,
            amount: t.amount,
            token_symbol: t.token,
            timestamp: t.timestamp,
            note: None,
        });
    }
    graph
}
```

## Comparison with JavaScript Version

| Feature | JavaScript (trace-svmai-flow.js) | Rust (trace_flow.rs) |
|---------|----------------------------------|---------------------|
| Type Safety | ❌ Dynamic typing | ✅ Static typing |
| Performance | ~Good | ✅ Excellent |
| Memory Safety | ❌ GC overhead | ✅ Zero-cost abstractions |
| Generics | ❌ Hardcoded SVMAI | ✅ Accepts any graph |
| Path Finding | ❌ Manual | ✅ Automated DFS |
| Reusability | ❌ Script-specific | ✅ Library + Binary |
| Dependencies | Node.js runtime | ✅ None (std only) |

## License

Same as the opensvm project.
