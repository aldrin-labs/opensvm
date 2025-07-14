declare module 'cytoscape-dagre' {
  import { Core, Extension } from 'cytoscape';
  
  interface DagreLayoutOptions {
    name: 'dagre';
    rankDir?: 'TB' | 'BT' | 'LR' | 'RL';
    align?: 'UL' | 'UR' | 'DL' | 'DR';
    nodeSep?: number;
    edgeSep?: number;
    rankSep?: number;
    marginX?: number;
    marginY?: number;
    acyclicer?: 'greedy' | undefined;
    ranker?: 'network-simplex' | 'tight-tree' | 'longest-path';
    minLen?: (edge: any) => number;
    edgeWeight?: (edge: any) => number;
    [key: string]: any;
  }

  const dagre: Extension;
  export = dagre;
}

declare namespace cytoscape {
  interface ElementDefinition {
    group?: 'nodes' | 'edges';
  }
  
  interface Core {
    dagre?: (options: any) => any;
  }
}