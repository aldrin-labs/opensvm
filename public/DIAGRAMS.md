# OpenSVM Diagrams

This document contains diagrams that explain the architecture, data flow, and key features of the OpenSVM explorer.

## System Architecture

```mermaid
flowchart TD
    subgraph Client
        UI[User Interface]
        ClientState[Client State]
    end
    
    subgraph NextJS[Next.js Application]
        Pages[Page Components]
        API[API Routes]
        ServerComponents[Server Components]
    end
    
    subgraph Core[Core Libraries]
        SolanaLib[Solana Library]
        AILib[AI Library]
        Utils[Utilities]
    end
    
    subgraph External[External Services]
        SolanaRPC[Solana RPC]
        LLM[Language Models]
        TokenRegistry[Token Registry]
    end
    
    UI --> Pages
    UI --> ClientState
    Pages --> ServerComponents
    ServerComponents --> API
    API --> SolanaLib
    API --> AILib
    SolanaLib --> SolanaRPC
    AILib --> LLM
    SolanaLib --> Utils
    SolanaLib --> TokenRegistry
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as User Interface
    participant API as API Routes
    participant Solana as Solana Library
    participant RPC as Solana RPC
    
    User->>UI: Request Data
    UI->>API: Fetch Data
    API->>Solana: Process Request
    Solana->>RPC: RPC Call
    RPC-->>Solana: Blockchain Data
    Solana-->>API: Processed Data
    API-->>UI: Formatted Response
    UI-->>User: Display Data
```

## Transaction Visualization Process

```mermaid
flowchart LR
    TX[Transaction Data] --> Parser[Transaction Parser]
    Parser --> Accounts[Account Extraction]
    Parser --> Instructions[Instruction Parsing]
    Parser --> TokenChanges[Token Changes]
    
    Accounts --> Graph[Graph Generator]
    Instructions --> Graph
    TokenChanges --> Graph
    
    Graph --> Layout[Layout Algorithm]
    Layout --> Renderer[Visual Renderer]
    Renderer --> Interactive[Interactive Visualization]
```

## Wallet Path Finding Algorithm

```mermaid
flowchart TD
    Start[Start Search] --> Init[Initialize Queue with Source Wallet]
    Init --> Loop{Queue Empty?}
    Loop -->|Yes| NotFound[Path Not Found]
    Loop -->|No| Dequeue[Dequeue Wallet]
    Dequeue --> Check{Is Target?}
    Check -->|Yes| Found[Path Found]
    Check -->|No| GetTransfers[Get Wallet Transfers]
    GetTransfers --> ProcessTransfers[Process Each Transfer]
    ProcessTransfers --> AddToQueue[Add New Wallets to Queue]
    AddToQueue --> Loop
    
    subgraph BFS Algorithm
        Loop
        Dequeue
        Check
        GetTransfers
        ProcessTransfers
        AddToQueue
    end
```

## AI Assistant Architecture

```mermaid
flowchart TD
    Query[User Query] --> NLP[Natural Language Processing]
    NLP --> Intent[Intent Recognition]
    
    Intent -->|Transaction Analysis| TxTool[Transaction Tool]
    Intent -->|Account Lookup| AccTool[Account Tool]
    Intent -->|Network Stats| NetTool[Network Tool]
    Intent -->|Path Finding| PathTool[Path Finding Tool]
    
    TxTool --> SolanaAPI[Solana API]
    AccTool --> SolanaAPI
    NetTool --> SolanaAPI
    PathTool --> PathAPI[Path Finding API]
    
    SolanaAPI --> Results[Tool Results]
    PathAPI --> Results
    
    Results --> LLM[Language Model]
    LLM --> Response[AI Response]
```

## Block Explorer Data Model

```mermaid
erDiagram
    BLOCK ||--o{ TRANSACTION : contains
    BLOCK {
        number slot
        string blockhash
        number parentSlot
        timestamp blockTime
        string previousBlockhash
    }
    
    TRANSACTION ||--o{ INSTRUCTION : contains
    TRANSACTION {
        string signature
        boolean success
        timestamp timestamp
        number slot
        string type
    }
    
    INSTRUCTION ||--o{ ACCOUNT : references
    INSTRUCTION {
        string program
        string programId
        json parsed
    }
    
    ACCOUNT ||--o{ TOKEN_BALANCE : has
    ACCOUNT {
        string address
        number lamports
        string owner
        boolean executable
    }
    
    TOKEN_BALANCE {
        string mint
        string owner
        number amount
        number decimals
    }
```

## User Interaction Flow

```mermaid
stateDiagram-v2
    [*] --> HomePage
    
    HomePage --> SearchResults: Search
    HomePage --> BlockDetails: Select Block
    HomePage --> AIAssistant: Open AI Chat
    
    SearchResults --> TransactionDetails: Select Transaction
    SearchResults --> AccountDetails: Select Account
    SearchResults --> TokenDetails: Select Token
    SearchResults --> ProgramDetails: Select Program
    
    BlockDetails --> TransactionDetails: Select Transaction
    
    TransactionDetails --> AccountDetails: Select Account
    TransactionDetails --> ProgramDetails: Select Program
    TransactionDetails --> TokenDetails: Select Token
    
    AccountDetails --> TransactionDetails: View Transaction
    AccountDetails --> TokenDetails: View Token
    
    state AIAssistant {
        [*] --> Query
        Query --> Processing
        Processing --> Response
        Response --> Query: New Question
    }
```

## Deployment Architecture

```mermaid
flowchart TD
    subgraph Development
        DevEnv[Development Environment]
        Testing[Testing]
    end
    
    subgraph CI/CD
        Build[Build Process]
        Test[Automated Tests]
        Deploy[Deployment]
    end
    
    subgraph Production
        CDN[Content Delivery Network]
        ServerlessFunc[Serverless Functions]
        EdgeFunctions[Edge Functions]
    end
    
    DevEnv --> Testing
    Testing --> Build
    Build --> Test
    Test --> Deploy
    Deploy --> CDN
    Deploy --> ServerlessFunc
    Deploy --> EdgeFunctions
    
    User[End User] --> CDN
    User --> ServerlessFunc
    User --> EdgeFunctions
```

## Performance Optimization Strategy

```mermaid
flowchart TD
    subgraph Client Optimization
        StaticGen[Static Generation]
        ClientCache[Browser Caching]
        CodeSplit[Code Splitting]
    end
    
    subgraph Server Optimization
        ServerCache[Server Caching]
        EdgeComputing[Edge Computing]
        DataIndexing[Data Indexing]
    end
    
    subgraph RPC Optimization
        ConnectionPool[Connection Pool]
        BatchRequests[Batch Requests]
        Fallbacks[Fallback Endpoints]
    end
    
    Request[User Request] --> StaticGen
    StaticGen --> ClientCache
    ClientCache --> ServerCache
    ServerCache --> EdgeComputing
    EdgeComputing --> ConnectionPool
    ConnectionPool --> BatchRequests
    BatchRequests --> Fallbacks
    Fallbacks --> Response[Fast Response]
```

## Solana Data Flow

```mermaid
flowchart LR
    subgraph Solana Blockchain
        Validators[Validators]
        Blocks[Blocks]
        Transactions[Transactions]
    end
    
    subgraph RPC Nodes
        RPCEndpoint[RPC Endpoint]
        RPCMethods[RPC Methods]
    end
    
    subgraph OpenSVM
        SolanaConnection[Solana Connection]
        DataProcessing[Data Processing]
        Visualization[Visualization]
    end
    
    Validators --> Blocks
    Blocks --> Transactions
    Transactions --> RPCEndpoint
    RPCEndpoint --> RPCMethods
    RPCMethods --> SolanaConnection
    SolanaConnection --> DataProcessing
    DataProcessing --> Visualization
    Visualization --> User[End User]
```