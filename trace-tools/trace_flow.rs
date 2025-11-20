use std::collections::{HashMap, HashSet};

/// Represents a single transfer in the graph
#[derive(Debug, Clone)]
pub struct Transfer {
    pub from: String,
    pub to: String,
    pub amount: f64,
    pub token_symbol: String,
    pub timestamp: Option<String>,
    pub note: Option<String>,
}

/// Represents a node in the transfer graph
#[derive(Debug, Clone)]
pub struct GraphNode {
    pub address: String,
    pub label: Option<String>,
    pub incoming: Vec<Transfer>,
    pub outgoing: Vec<Transfer>,
}

/// Configuration for rendering ASCII output
#[derive(Debug, Clone)]
pub struct RenderConfig {
    pub title: String,
    pub origin_icon: String,
    pub target_icon: String,
    pub node_icon: String,
    pub show_header: bool,
    pub show_paths_summary: bool,
    pub show_stats_summary: bool,
    pub address_truncate_length: usize,
}

impl Default for RenderConfig {
    fn default() -> Self {
        RenderConfig {
            title: "TOKEN DISTRIBUTION TRACE".to_string(),
            origin_icon: "🏦 ORIGIN".to_string(),
            target_icon: "🎯 TARGET".to_string(),
            node_icon: "○".to_string(),
            show_header: true,
            show_paths_summary: true,
            show_stats_summary: true,
            address_truncate_length: 12,
        }
    }
}

/// Represents the complete transfer graph
pub struct TransferGraph {
    pub nodes: HashMap<String, GraphNode>,
    pub origin: Option<String>,
    pub target: Option<String>,
    pub token_name: Option<String>,
    pub token_mint: Option<String>,
    pub render_config: RenderConfig,
}

impl TransferGraph {
    pub fn new() -> Self {
        TransferGraph {
            nodes: HashMap::new(),
            origin: None,
            target: None,
            token_name: None,
            token_mint: None,
            render_config: RenderConfig::default(),
        }
    }

    pub fn with_config(config: RenderConfig) -> Self {
        TransferGraph {
            nodes: HashMap::new(),
            origin: None,
            target: None,
            token_name: None,
            token_mint: None,
            render_config: config,
        }
    }

    /// Add a transfer to the graph
    pub fn add_transfer(&mut self, transfer: Transfer) {
        // Add to sender's outgoing
        self.nodes
            .entry(transfer.from.clone())
            .or_insert_with(|| GraphNode {
                address: transfer.from.clone(),
                label: None,
                incoming: Vec::new(),
                outgoing: Vec::new(),
            })
            .outgoing
            .push(transfer.clone());

        // Add to receiver's incoming
        self.nodes
            .entry(transfer.to.clone())
            .or_insert_with(|| GraphNode {
                address: transfer.to.clone(),
                label: None,
                incoming: Vec::new(),
                outgoing: Vec::new(),
            })
            .incoming
            .push(transfer);
    }

    /// Set a label for a node
    pub fn set_node_label(&mut self, address: &str, label: String) {
        if let Some(node) = self.nodes.get_mut(address) {
            node.label = Some(label);
        }
    }

    /// Find all paths from origin to target
    pub fn find_paths(&self, from: &str, to: &str) -> Vec<Vec<String>> {
        let mut paths = Vec::new();
        let mut current_path = Vec::new();
        let mut visited = HashSet::new();
        
        self.dfs_paths(from, to, &mut current_path, &mut visited, &mut paths);
        paths
    }

    fn dfs_paths(
        &self,
        current: &str,
        target: &str,
        path: &mut Vec<String>,
        visited: &mut HashSet<String>,
        all_paths: &mut Vec<Vec<String>>,
    ) {
        path.push(current.to_string());
        visited.insert(current.to_string());

        if current == target {
            all_paths.push(path.clone());
        } else if let Some(node) = self.nodes.get(current) {
            for transfer in &node.outgoing {
                if !visited.contains(&transfer.to) {
                    self.dfs_paths(&transfer.to, target, path, visited, all_paths);
                }
            }
        }

        visited.remove(current);
        path.pop();
    }

    /// Render the graph as ASCII art using the configured settings
    pub fn render_ascii(&self) -> String {
        let mut output = String::new();
        let cfg = &self.render_config;
        
        // Header with configurable title
        if cfg.show_header {
            let title_padded = self.center_text(&cfg.title, 74);
            output.push_str("╔══════════════════════════════════════════════════════════════════════════╗\n");
            output.push_str(&format!("║{}║\n", title_padded));
            output.push_str("╚══════════════════════════════════════════════════════════════════════════╝\n\n");
        }

        if let Some(token) = &self.token_name {
            output.push_str(&format!("TOKEN: {}", token));
            if let Some(mint) = &self.token_mint {
                output.push_str(&format!(" ({})", self.truncate_address(mint, 8)));
            }
            output.push_str("\n");
        }

        if let Some(target) = &self.target {
            output.push_str(&format!("TARGET: {}\n\n", target));
        }

        output.push_str("═══════════════════════════════════════════════════════════════════════════\n\n");

        // Render the graph tree starting from origin
        if let Some(origin_addr) = &self.origin {
            self.render_node(&mut output, origin_addr, 0, &mut HashSet::new(), true);
        }

        // Render paths summary if configured and we have origin and target
        if cfg.show_paths_summary {
            if let (Some(origin), Some(target)) = (&self.origin, &self.target) {
                let paths = self.find_paths(origin, target);
                output.push_str("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
                output.push_str(&format!("PATHS SUMMARY ({} paths found):\n\n", paths.len()));
                
                for (idx, path) in paths.iter().enumerate() {
                    output.push_str(&format!("PATH #{}: ", idx + 1));
                    for (i, addr) in path.iter().enumerate() {
                        if i > 0 {
                            output.push_str(" → ");
                        }
                        output.push_str(&self.truncate_address(addr, 8));
                    }
                    output.push_str("\n");
                }
            }
        }

        // Summary section if configured
        if cfg.show_stats_summary {
            output.push_str("\n┌─────────────────────────────────────────────────────────────────────────┐\n");
            output.push_str(&format!("│ Total Nodes: {:>58} │\n", self.nodes.len()));
            
            let total_transfers: usize = self.nodes.values()
                .map(|n| n.outgoing.len())
                .sum();
            output.push_str(&format!("│ Total Transfers: {:>54} │\n", total_transfers));
            
            if let Some(target_addr) = &self.target {
                if let Some(target_node) = self.nodes.get(target_addr) {
                    let total_received: f64 = target_node.incoming.iter()
                        .map(|t| t.amount)
                        .sum();
                    output.push_str(&format!("│ Target Received: {:>54.2} │\n", total_received));
                }
            }
            output.push_str("└─────────────────────────────────────────────────────────────────────────┘\n");
        }

        output
    }

    fn center_text(&self, text: &str, width: usize) -> String {
        let text_len = text.len();
        if text_len >= width {
            return text.to_string();
        }
        let padding = (width - text_len) / 2;
        let extra = (width - text_len) % 2;
        format!("{}{}{}", " ".repeat(padding), text, " ".repeat(padding + extra))
    }

    fn render_node(
        &self,
        output: &mut String,
        addr: &str,
        depth: usize,
        visited: &mut HashSet<String>,
        is_origin: bool,
    ) {
        if visited.contains(addr) {
            return;
        }
        visited.insert(addr.to_string());

        let indent = "      ".repeat(depth);  // Increased from 3 to 6 spaces per level
        let node = self.nodes.get(addr);
        let cfg = &self.render_config;
        
        // Node header with configurable icons
        if is_origin {
            output.push_str(&cfg.origin_icon);
        } else if Some(addr) == self.target.as_deref() {
            output.push_str(&format!("{}{}", indent, cfg.target_icon));
        } else {
            output.push_str(&format!("{}{}", indent, cfg.node_icon));
        }

        // Node label or address
        if let Some(node) = node {
            if let Some(label) = &node.label {
                output.push_str(&format!(" {}", label));
            }
        }
        output.push_str(&format!(" {}\n", self.truncate_address(addr, cfg.address_truncate_length)));

        // Render outgoing transfers
        if let Some(node) = node {
            let outgoing_count = node.outgoing.len();
            for (idx, transfer) in node.outgoing.iter().enumerate() {
                let is_last = idx == outgoing_count - 1;
                let connector = if is_last { "└──────→" } else { "├──────→" };  // Longer connectors
                
                output.push_str(&format!(
                    "{}      {} [{} {}]",
                    indent,
                    connector,
                    self.format_amount(transfer.amount),
                    transfer.token_symbol
                ));
                
                if let Some(ts) = &transfer.timestamp {
                    output.push_str(&format!(" ({})", ts));
                }
                
                if let Some(note) = &transfer.note {
                    output.push_str(&format!(" [{}]", note));
                }
                
                output.push_str(&format!(" ────────→ {}\n", self.truncate_address(&transfer.to, cfg.address_truncate_length)));
                
                // Add vertical spacing between sibling nodes (except before the last one)
                if !visited.contains(&transfer.to) {
                    self.render_node(output, &transfer.to, depth + 1, visited, false);
                    
                    // Add blank line after each child node for better visual separation
                    if !is_last {
                        output.push_str("\n");
                    }
                }
            }
        }
    }

    fn truncate_address(&self, addr: &str, keep: usize) -> String {
        if addr.len() <= keep * 2 {
            addr.to_string()
        } else {
            format!("{}...{}", &addr[..keep], &addr[addr.len()-keep..])
        }
    }
    
    fn format_amount(&self, amount: f64) -> String {
        let formatted = format!("{:.2}", amount);
        let parts: Vec<&str> = formatted.split('.').collect();
        let integer_part = parts[0];
        let decimal_part = if parts.len() > 1 { parts[1] } else { "00" };
        
        // Add thousand separators
        let mut result = String::new();
        let chars: Vec<char> = integer_part.chars().collect();
        for (i, c) in chars.iter().enumerate() {
            if i > 0 && (chars.len() - i) % 3 == 0 {
                result.push(',');
            }
            result.push(*c);
        }
        
        format!("{}.{}", result, decimal_part)
    }
}

impl Default for TransferGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_graph() {
        let mut graph = TransferGraph::new();
        graph.token_name = Some("SVMAI".to_string());
        graph.token_mint = Some("Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump".to_string());
        graph.origin = Some("Origin123".to_string());
        graph.target = Some("Target789".to_string());

        graph.add_transfer(Transfer {
            from: "Origin123".to_string(),
            to: "Middle456".to_string(),
            amount: 1000.0,
            token_symbol: "SVMAI".to_string(),
            timestamp: Some("2024-01-01".to_string()),
            note: None,
        });

        graph.add_transfer(Transfer {
            from: "Middle456".to_string(),
            to: "Target789".to_string(),
            amount: 500.0,
            token_symbol: "SVMAI".to_string(),
            timestamp: Some("2024-01-02".to_string()),
            note: Some("Final transfer".to_string()),
        });

        let output = graph.render_ascii();
        println!("{}", output);
        
        assert!(output.contains("SVMAI"));
        assert!(output.contains("Origin123"));
        assert!(output.contains("Target789"));
    }

    #[test]
    fn test_find_paths() {
        let mut graph = TransferGraph::new();
        
        // Create a simple path: A -> B -> C
        graph.add_transfer(Transfer {
            from: "A".to_string(),
            to: "B".to_string(),
            amount: 100.0,
            token_symbol: "TOKEN".to_string(),
            timestamp: None,
            note: None,
        });
        
        graph.add_transfer(Transfer {
            from: "B".to_string(),
            to: "C".to_string(),
            amount: 50.0,
            token_symbol: "TOKEN".to_string(),
            timestamp: None,
            note: None,
        });

        let paths = graph.find_paths("A", "C");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0], vec!["A", "B", "C"]);
    }

    #[test]
    fn test_svmai_example() {
        // Example: Create a sample SVMAI-like graph
        let mut graph = TransferGraph::new();
        
        graph.token_name = Some("SVMAI".to_string());
        graph.token_mint = Some("Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump".to_string());
        graph.origin = Some("EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC".to_string());
        graph.target = Some("5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85".to_string());

        // Add sample transfers
        graph.add_transfer(Transfer {
            from: "EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC".to_string(),
            to: "7q34BaA8vaNnqKMnzF8DtoxtveKSNcgKEUBSy72pgNng".to_string(),
            amount: 31151612.0,
            token_symbol: "SVMAI".to_string(),
            timestamp: Some("Dec 26, 2024 10:51:22 UTC".to_string()),
            note: Some("Initial Distribution".to_string()),
        });

        graph.add_transfer(Transfer {
            from: "7q34BaA8vaNnqKMnzF8DtoxtveKSNcgKEUBSy72pgNng".to_string(),
            to: "BUZZ5JEG9NLQY4RAFt5fLPiYBZVbXtQ3YTSjd5bMsfsf".to_string(),
            amount: 21658962.0,
            token_symbol: "SVMAI".to_string(),
            timestamp: None,
            note: None,
        });

        graph.add_transfer(Transfer {
            from: "BUZZ5JEG9NLQY4RAFt5fLPiYBZVbXtQ3YTSjd5bMsfsf".to_string(),
            to: "5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85".to_string(),
            amount: 16000000.0,
            token_symbol: "SVMAI".to_string(),
            timestamp: Some("Jan 1, 2025 01:05:19".to_string()),
            note: Some("Direct Path".to_string()),
        });

        // Set labels for important nodes
        graph.set_node_label("EQ3iykiT6Jg1ReuaaLc2bnxFXwxBkiXgZifYJxaULAEC", "MINT".to_string());
        graph.set_node_label("7q34BaA8vaNnqKMnzF8DtoxtveKSNcgKEUBSy72pgNng", "Primary Distributor".to_string());
        graph.set_node_label("BUZZ5JEG9NLQY4RAFt5fLPiYBZVbXtQ3YTSjd5bMsfsf", "BUZZ Hub".to_string());

        // Render the graph
        let output = graph.render_ascii();
        println!("{}", output);
        
        assert!(output.contains("SVMAI"));
        assert!(output.contains("TOKEN DISTRIBUTION TRACE"));
        assert_eq!(graph.nodes.len(), 4);
    }
}
