# Page snapshot

```yaml
- alert
- navigation "Main navigation":
  - link "OPENSVM [AI]":
    - /url: /
  - text: 1:14:55 PM
  - searchbox "Search"
  - button "Search Settings":
    - img
  - button "Explore"
  - button "Tokens"
  - button "DeFi"
  - button "Analytics"
  - button:
    - img
  - button "Connect Wallet"
  - button "Open AI Assistant": AI Assistant
- main:
  - heading "Error Loading Transaction" [level=2]
  - paragraph: "Server error: Failed to fetch transaction Details: { \"name\": \"SolanaJSONRPCError\", \"message\": \"failed to get transaction: Invalid param: WrongSize\", \"stack\": \"SolanaJSONRPCError: failed to get transaction: Invalid param: WrongSize\\n at ProxyConnection.getParsedTransaction (webpack-internal:///(rsc)/./node_modules/@solana/web3.js/lib/index.esm.js:7584:13)\\n at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\\n at async EnhancedTransactionFetcher.fetchEnhancedTransaction (webpack-internal:///(rsc)/./lib/enhanced-transaction-fetcher.ts:34:20)\\n at async GET (webpack-internal:///(rsc)/./app/api/transaction/[signature]/route.ts:168:28)\\n at async AppRouteRouteModule.do (/workspace/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:5:38782)\\n at async AppRouteRouteModule.handle (/workspace/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:5:45984)\\n at async responseGenerator (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute&page=%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute.ts&appDir=%2Fworkspace%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fworkspace&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:203:38)\\n at async AppRouteRouteModule.handleResponse (/workspace/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:1:183647)\\n at async handleResponse (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute&page=%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute.ts&appDir=%2Fworkspace%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fworkspace&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:265:32)\\n at async handler (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute&page=%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftransaction%2F%5Bsignature%5D%2Froute.ts&appDir=%2Fworkspace%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fworkspace&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:317:13)\\n at async doRender (/workspace/node_modules/next/dist/server/base-server.js:1586:34)\\n at async DevServer.renderToResponseWithComponentsImpl (/workspace/node_modules/next/dist/server/base-server.js:1928:13)\\n at async DevServer.renderPageComponent (/workspace/node_modules/next/dist/server/base-server.js:2394:24)\\n at async DevServer.renderToResponseImpl (/workspace/node_modules/next/dist/server/base-server.js:2434:32)\\n at async DevServer.pipeImpl (/workspace/node_modules/next/dist/server/base-server.js:1034:25)\\n at async NextNodeServer.handleCatchallRenderRequest (/workspace/node_modules/next/dist/server/next-server.js:393:17)\\n at async DevServer.handleRequestImpl (/workspace/node_modules/next/dist/server/base-server.js:925:17)\\n at async /workspace/node_modules/next/dist/server/dev/next-dev-server.js:398:20\\n at async Span.traceAsyncFn (/workspace/node_modules/next/dist/trace/trace.js:157:20)\\n at async DevServer.handleRequest (/workspace/node_modules/next/dist/server/dev/next-dev-server.js:394:24)\\n at async invokeRender (/workspace/node_modules/next/dist/server/lib/router-server.js:239:21)\\n at async handleRequest (/workspace/node_modules/next/dist/server/lib/router-server.js:436:24)\\n at async requestHandlerImpl (/workspace/node_modules/next/dist/server/lib/router-server.js:464:13)\\n at async Server.requestListener (/workspace/node_modules/next/dist/server/lib/start-server.js:218:13)\" }"
  - paragraph: "Transaction signature:"
  - code: 4SqVfYyUhq6PKApAZYuVBk2VH4VL9Hk3WUP3REVPUwfpLvgdF5zPUJoqGKQLZ6jRv4F8rH6mVLimnZEP
  - paragraph: "Possible reasons:"
  - list:
    - listitem: The transaction signature is invalid
    - listitem: The transaction has been pruned from the ledger
    - listitem: Network connectivity issues
    - listitem: RPC node rate limits
    - listitem: Server-side processing errors
  - button "Try Again"
```