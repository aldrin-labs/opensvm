'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CodeIcon,
    TerminalIcon,
    ExternalLinkIcon,
    CopyIcon,
    CheckIcon,
    AlertTriangleIcon,
    InfoIcon,
    BookOpenIcon,
    LightbulbIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSettings } from '@/lib/settings';

interface CodeExample {
    title: string;
    language: string;
    code: string;
    description?: string;
}

interface IntegrationGuideProps {
    apiKey?: string;
}

export default function IntegrationGuide({ apiKey }: IntegrationGuideProps = {}) {
    const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

    // Get user settings for theme and font
    const settings = useSettings();

    // Theme-aware CSS classes
    const themeClasses = {
        container: "space-y-4 sm:space-y-6 p-4 sm:p-6",
        header: "mb-6 sm:mb-8",
        title: "text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 flex-wrap",
        subtitle: "text-muted-foreground mt-2",
        tabsContainer: "w-full",
        tabsList: "grid w-full grid-cols-2 sm:grid-cols-4",
        codeBlock: "bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto",
        codeHeader: "flex items-center justify-between mb-2",
        codeTitle: "text-sm font-medium text-muted-foreground",
        stepCard: "border-l-4 border-primary pl-4 py-2",
        stepNumber: "inline-flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-sm font-bold mr-3",
        stepTitle: "font-semibold text-base mb-2",
        stepContent: "text-muted-foreground",
        infoCard: "bg-primary/5 border border-primary/20 p-4 rounded-lg",
        infoHeader: "flex items-center gap-2 text-primary font-medium mb-2",
        infoContent: "text-sm text-primary/80",
        warningCard: "bg-warning/5 border border-warning/20 p-4 rounded-lg",
        warningHeader: "flex items-center gap-2 text-warning font-medium mb-2",
        warningContent: "text-sm text-warning/80",
        exampleGrid: "grid sm:grid-cols-2 gap-4 sm:gap-6",
        exampleCard: "p-4 border rounded-lg",
        exampleTitle: "font-medium mb-2 flex items-center gap-2",
        exampleCode: "bg-muted p-3 rounded text-sm font-mono overflow-x-auto",
        linkButton: "inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm",
        featureList: "space-y-2 text-sm text-muted-foreground",
        featureItem: "flex items-start gap-2"
    };

    // Apply font family from settings
    const fontClass = settings.fontFamily === 'berkeley' ? 'font-mono' :
        settings.fontFamily === 'jetbrains' ? 'font-mono' :
            'font-sans';

    // Apply font size from settings
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' :
        settings.fontSize === 'large' ? 'text-lg' :
            'text-base';

    const baseUrl = 'https://opensvm.com/v1';
    const exampleKey = apiKey || 'sk-ant-api03-your-key-here'; // Use provided API key or placeholder

    const copyToClipboard = (code: string, label: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(code);
        }
        setCopiedCode(label);
        try {
            toast.success(`${label} copied to clipboard!`);
        } catch {
            // Fallback if toast fails
            console.log(`${label} copied to clipboard!`);
        }
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const CodeBlock = ({ example, label }: { example: CodeExample; label: string }) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{example.title}</h4>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(example.code, label)}
                    className="h-8"
                    aria-label={`Copy ${example.title}`}
                    title={`Copy ${example.title}`}
                >
                    {copiedCode === label ? (
                        <CheckIcon className="h-3 w-3 text-success" />
                    ) : (
                        <CopyIcon className="h-3 w-3" />
                    )}
                    <span className="sr-only">Copy</span>
                </Button>
            </div>
            {example.description && (
                <p className="text-sm text-muted-foreground">{example.description}</p>
            )}
            <pre className={themeClasses.exampleCode}>
                <code>{example.code}</code>
            </pre>
        </div>
    );

    const pythonExamples: CodeExample[] = [
        {
            title: "Installation & Basic Setup",
            language: "bash",
            code: `# Install the official Anthropic Python library
pip install anthropic

# Or with conda
conda install anthropic`,
            description: "Install the official Anthropic Python SDK"
        },
        {
            title: "Basic Message Example",
            language: "python",
            code: `import anthropic

# Initialize client with OpenSVM endpoint
client = anthropic.Anthropic(
    api_key="${exampleKey}",
    base_url="${baseUrl}"
)

# Send a message
response = client.messages.create(
    model="claude-3-haiku-20240307",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello Claude!"}
    ]
)

print(response.content[0].text)`,
            description: "Basic message sending with the Python SDK"
        },
        {
            title: "Streaming Response",
            language: "python",
            code: `# Streaming response for real-time output
stream = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    stream=True,
    messages=[
        {"role": "user", "content": "Write a short story"}
    ]
)

for chunk in stream:
    if chunk.type == "content_block_delta":
        print(chunk.delta.text, end="", flush=True)`,
            description: "Stream responses for real-time text generation"
        },
        {
            title: "Environment Variables",
            language: "python",
            code: `import os
from anthropic import Anthropic

# Using environment variables (recommended)
client = Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
    base_url=os.environ.get("ANTHROPIC_BASE_URL", "${baseUrl}")
)

# Alternative: using python-dotenv
from dotenv import load_dotenv
load_dotenv()

client = Anthropic()  # Will use env vars automatically`,
            description: "Secure API key management with environment variables"
        }
    ];

    const javascriptExamples: CodeExample[] = [
        {
            title: "Installation & Setup",
            language: "bash",
            code: `# Install the official Anthropic JavaScript SDK
npm install @anthropic-ai/sdk

# Or with yarn
yarn add @anthropic-ai/sdk`,
            description: "Install the official Anthropic JavaScript/TypeScript SDK"
        },
        {
            title: "Basic Usage (JavaScript)",
            language: "javascript",
            code: `import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: '${exampleKey}',
  baseURL: '${baseUrl}'
});

async function sendMessage() {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello Claude!' }
    ]
  });
  
  console.log(response.content[0].text);
}

sendMessage();`,
            description: "Basic message sending with the JavaScript SDK"
        },
        {
            title: "TypeScript Example",
            language: "typescript",
            code: `import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

class ClaudeClient {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({
      apiKey,
      baseURL: '${baseUrl}'
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages
    });

    return response.content[0].text;
  }
}

// Usage
const client = new ClaudeClient('${exampleKey}');
const reply = await client.chat([
  { role: 'user', content: 'Explain TypeScript benefits' }
]);`,
            description: "Type-safe TypeScript implementation"
        },
        {
            title: "Streaming in JavaScript",
            language: "javascript",
            code: `// Streaming response
const stream = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 1024,
  stream: true,
  messages: [
    { role: 'user', content: 'Tell me a joke' }
  ]
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    process.stdout.write(chunk.delta.text);
  }
}`,
            description: "Stream responses for real-time output"
        }
    ];

    const cliExamples: CodeExample[] = [
        {
            title: "Claude CLI Installation",
            language: "bash",
            code: `# Install Claude CLI
pip install claude-cli

# Or via npm
npm install -g @anthropic-ai/claude-cli`,
            description: "Install the official Claude CLI tool"
        },
        {
            title: "Environment Setup",
            language: "bash",
            code: `# Set environment variables
export ANTHROPIC_API_KEY="${exampleKey}"
export ANTHROPIC_BASE_URL="${baseUrl}"

# Or add to your shell profile (~/.bashrc, ~/.zshrc)
echo 'export ANTHROPIC_API_KEY="${exampleKey}"' >> ~/.bashrc
echo 'export ANTHROPIC_BASE_URL="${baseUrl}"' >> ~/.bashrc
source ~/.bashrc`,
            description: "Configure environment variables for Claude CLI"
        },
        {
            title: "Basic CLI Usage",
            language: "bash",
            code: `# Simple question
claude "What is machine learning?"

# Interactive mode
claude --interactive

# Specify model
claude --model claude-3-sonnet-20240229 "Explain quantum computing"

# File input
claude --file document.txt "Summarize this document"

# Output to file
claude "Write a Python function" > output.py`,
            description: "Common Claude CLI commands and options"
        }
    ];

    const curlExamples: CodeExample[] = [
        {
            title: "Basic cURL Request",
            language: "bash",
            code: `curl -X POST ${baseUrl}/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${exampleKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello Claude!"}
    ]
  }'`,
            description: "Direct HTTP API call using cURL"
        },
        {
            title: "Streaming Request",
            language: "bash",
            code: `curl -X POST ${baseUrl}/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${exampleKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {"role": "user", "content": "Write a haiku"}
    ]
  }'`,
            description: "Streaming response with cURL"
        },
        {
            title: "Get Available Models",
            language: "bash",
            code: `curl -X GET ${baseUrl}/models \\
  -H "Authorization: Bearer ${exampleKey}" \\
  -H "anthropic-version: 2023-06-01"`,
            description: "List all available Claude models"
        }
    ];

    const troubleshootingTips = [
        {
            issue: "Authentication Error (401)",
            solution: "Check that your API key is correct and properly formatted (starts with 'sk-ant-api03-')",
            code: `# Verify your API key format
echo $ANTHROPIC_API_KEY | grep "^sk-ant-api03-"`
        },
        {
            issue: "Payment Required (402)",
            solution: "Your SVMAI balance is insufficient. Add more tokens through the deposit interface.",
            code: `# Check your balance via API
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \\
     -H "x-user-id: your-user-id" \\
     ${baseUrl.replace('/v1', '')}/opensvm/balance`
        },
        {
            issue: "Rate Limit Error (429)",
            solution: "You're making requests too quickly. Implement exponential backoff or reduce request frequency.",
            code: `# Python retry with backoff
import time
import random

def retry_with_backoff(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt < max_retries - 1:
                delay = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(delay)
            else:
                raise e`
        },
        {
            issue: "Connection Timeout",
            solution: "Increase timeout values or check your network connection.",
            code: `# Python with custom timeout
client = anthropic.Anthropic(
    api_key="your-key",
    base_url="${baseUrl}",
    timeout=60.0  # 60 seconds
)`
        }
    ];

    return (
        <div className={`${themeClasses.container} ${fontClass} ${fontSizeClass}`}>
            <div className={themeClasses.header}>
                <h1 className={themeClasses.title}>
                    <BookOpenIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    Integration Guide
                </h1>
                <p className={themeClasses.subtitle}>
                    Learn how to integrate the Anthropic API with SVMAI billing into your applications
                </p>
            </div>

            <Card className={themeClasses.infoCard}>
                <CardHeader>
                    <CardTitle className={themeClasses.infoHeader}>
                        <InfoIcon className="h-5 w-5" />
                        Getting Started
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className={themeClasses.stepCard}>
                            <div className="flex items-start">
                                <span className={themeClasses.stepNumber}>1</span>
                                <div>
                                    <h3 className={themeClasses.stepTitle}>Generate an API Key</h3>
                                    <p className={themeClasses.stepContent}>
                                        Create a new API key from the key management section above
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className={themeClasses.stepCard}>
                            <div className="flex items-start">
                                <span className={themeClasses.stepNumber}>2</span>
                                <div>
                                    <h3 className={themeClasses.stepTitle}>Add SVMAI Balance</h3>
                                    <p className={themeClasses.stepContent}>
                                        Deposit SVMAI tokens to your account to pay for API usage
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className={themeClasses.stepCard}>
                            <div className="flex items-start">
                                <span className={themeClasses.stepNumber}>3</span>
                                <div>
                                    <h3 className={themeClasses.stepTitle}>Update Your Code</h3>
                                    <p className={themeClasses.stepContent}>
                                        Change your base URL to https://opensvm.com/v1 and use your new API key
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Start */}
            <Card className={themeClasses.infoCard}>
                <CardHeader>
                    <CardTitle className={themeClasses.infoHeader}>
                        <LightbulbIcon className="h-5 w-5" />
                        Quick Start
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold mb-2">🔑 Your API Configuration</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Base URL:</span>
                                    <code className="bg-white px-2 py-1 rounded">{baseUrl}</code>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">API Key:</span>
                                    <code className="bg-white px-2 py-1 rounded">
                                        {exampleKey ? `${exampleKey.substring(0, 16)}...` : 'Create an API key first'}
                                    </code>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">✅ Compatibility</h4>
                            <div className="space-y-1 text-sm">
                                <p>• Full Anthropic API compatibility</p>
                                <p>• Works with all official SDKs</p>
                                <p>• Claude CLI supported</p>
                                <p>• Streaming responses included</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Integration Tabs */}
            <Tabs defaultValue="python" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="python" className="flex items-center gap-2">
                        <CodeIcon className="h-4 w-4" />
                        Python
                    </TabsTrigger>
                    <TabsTrigger value="javascript" className="flex items-center gap-2">
                        <CodeIcon className="h-4 w-4" />
                        JavaScript
                    </TabsTrigger>
                    <TabsTrigger value="cli" className="flex items-center gap-2">
                        <TerminalIcon className="h-4 w-4" />
                        CLI
                    </TabsTrigger>
                    <TabsTrigger value="curl" className="flex items-center gap-2">
                        <TerminalIcon className="h-4 w-4" />
                        cURL
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="python" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CodeIcon className="h-5 w-5 text-primary" />
                                Python SDK Integration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <div className={themeClasses.exampleTitle}>
                                    <CodeIcon className="h-5 w-5 text-primary" />
                                    Python SDK
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="font-medium mb-2">Installation</h4>
                                        <pre className={themeClasses.exampleCode}>
                                            <code>pip install anthropic</code>
                                        </pre>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Basic Usage</h4>
                                        <pre className={themeClasses.exampleCode}>
                                            <code>{`import anthropic

client = anthropic.Anthropic(
    api_key="sk-ant-api03-your-key-here",
    base_url="https://opensvm.com/v1"
)

message = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello Claude!"}
    ]
)

print(message.content)`}</code>
                                        </pre>
                                    </div>
                                </div>
                            </div>
                            {pythonExamples.map((example, index) => (
                                <CodeBlock
                                    key={index}
                                    example={example}
                                    label={`Python ${index + 1}`}
                                />
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="javascript" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CodeIcon className="h-5 w-5 text-secondary" />
                                JavaScript/TypeScript SDK
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <div className={themeClasses.exampleTitle}>
                                    <CodeIcon className="h-5 w-5 text-secondary" />
                                    JavaScript/TypeScript SDK
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="font-medium mb-2">Installation</h4>
                                        <pre className={themeClasses.exampleCode}>
                                            <code>npm install @anthropic-ai/sdk</code>
                                        </pre>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Basic Usage</h4>
                                        <pre className={themeClasses.exampleCode}>
                                            <code>{`import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'sk-ant-api03-your-key-here',
  baseURL: 'https://opensvm.com/v1'
});

const message = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello Claude!' }
  ]
});

console.log(message.content);`}</code>
                                        </pre>
                                    </div>
                                </div>
                            </div>
                            {javascriptExamples.map((example, index) => (
                                <CodeBlock
                                    key={index}
                                    example={example}
                                    label={`JavaScript ${index + 1}`}
                                />
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cli" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TerminalIcon className="h-5 w-5 text-purple-600" />
                                Claude CLI
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {cliExamples.map((example, index) => (
                                <CodeBlock
                                    key={index}
                                    example={example}
                                    label={`CLI ${index + 1}`}
                                />
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="curl" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TerminalIcon className="h-5 w-5 text-orange-600" />
                                Direct HTTP API (cURL)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {curlExamples.map((example, index) => (
                                <CodeBlock
                                    key={index}
                                    example={example}
                                    label={`cURL ${index + 1}`}
                                />
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Best Practices */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <InfoIcon className="h-5 w-5" />
                        Best Practices
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={themeClasses.exampleGrid}>
                        <div>
                            <h4 className="font-semibold mb-3 text-success">✅ Do</h4>
                            <ul className={themeClasses.featureList}>
                                <li className={themeClasses.featureItem}>
                                    <CheckIcon className="h-4 w-4 text-success mt-0.5" />
                                    <span>Use environment variables for API keys</span>
                                </li>
                                <li className={themeClasses.featureItem}>
                                    <CheckIcon className="h-4 w-4 text-success mt-0.5" />
                                    <span>Monitor your usage and costs regularly</span>
                                </li>
                                <li className={themeClasses.featureItem}>
                                    <CheckIcon className="h-4 w-4 text-success mt-0.5" />
                                    <span>Use appropriate models for your use case</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-3 text-destructive">❌ Don't</h4>
                            <ul className={themeClasses.featureList}>
                                <li className={themeClasses.featureItem}>
                                    <AlertTriangleIcon className="h-4 w-4 text-destructive mt-0.5" />
                                    <span>Don't hardcode API keys in your source code</span>
                                </li>
                                <li className={themeClasses.featureItem}>
                                    <AlertTriangleIcon className="h-4 w-4 text-destructive mt-0.5" />
                                    <span>Share API keys in public repositories</span>
                                </li>
                                <li className={themeClasses.featureItem}>
                                    <AlertTriangleIcon className="h-4 w-4 text-destructive mt-0.5" />
                                    <span>Use production keys for development</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Troubleshooting */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangleIcon className="h-5 w-5" />
                        Troubleshooting
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        {troubleshootingTips.map((tip, index) => (
                            <div key={index} className={themeClasses.warningCard}>
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon className="h-5 w-5 text-warning mt-0.5" />
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-foreground">{tip.issue}</h4>
                                        <p className="text-sm text-muted-foreground">{tip.solution}</p>
                                        {tip.code && (
                                            <pre className={themeClasses.exampleCode}>
                                                <code>{tip.code}</code>
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Additional Resources */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ExternalLinkIcon className="h-5 w-5" />
                        Additional Resources
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={themeClasses.exampleGrid}>
                        <div>
                            <h4 className="font-semibold mb-3">📚 Documentation</h4>
                            <div className="space-y-2">
                                <a href="https://docs.anthropic.com" className={themeClasses.linkButton}>
                                    <ExternalLinkIcon className="h-4 w-4" />
                                    Anthropic API Documentation
                                </a>
                                <a href="https://github.com/anthropics/anthropic-sdk-python" className={themeClasses.linkButton}>
                                    <ExternalLinkIcon className="h-4 w-4" />
                                    Python SDK Repository
                                </a>
                                <a href="https://github.com/anthropics/anthropic-sdk-typescript" className={themeClasses.linkButton}>
                                    <ExternalLinkIcon className="h-4 w-4" />
                                    TypeScript SDK Repository
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-3">🤝 Support</h4>
                            <div className={themeClasses.featureList}>
                                <p className="text-muted-foreground">• OpenSVM Discord Community</p>
                                <p className="text-muted-foreground">• GitHub Issues & Discussions</p>
                                <p className="text-muted-foreground">• API Usage Dashboard</p>
                                <p className="text-muted-foreground">• Integration Examples Repository</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
