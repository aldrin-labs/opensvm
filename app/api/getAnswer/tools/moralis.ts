export const moralis_swagger = `
"swaggerDoc": {
    "openapi": "3.0.0",
    "info": {
      "title": "Moralis Solana API",
      "version": "1.0"
    },
    "servers": [
      {
        "url": "https://solana-gateway.moralis.io"
      }
    ],
    "paths": {
      "/token/{network}/{address}/pairs/stats": {
        "get": {
          "description": "Get aggregated statistics across supported pairs of a token.",
          "operationId": "getAggregatedTokenPairStats",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/SupportedPairStatsResponse"
                  }
                }
              }
            }
          },
          "summary": "Get aggregated token pair statistics by address",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/pairs/{address}/ohlcv": {
        "get": {
          "description": "Gets the candlesticks for a specific pair address",
          "operationId": "getCandleSticks",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "fromDate",
              "required": true,
              "in": "query",
              "description": "The starting date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "default": "2024-10-09",
                "type": "string"
              }
            },
            {
              "name": "toDate",
              "required": true,
              "in": "query",
              "description": "The ending date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "default": "2024-10-10",
                "type": "string"
              }
            },
            {
              "name": "timeframe",
              "required": true,
              "in": "query",
              "description": "The interval of the candle stick",
              "schema": {
                "default": "1min",
                "enum": [
                  "1s",
                  "10s",
                  "30s",
                  "1min",
                  "5min",
                  "10min",
                  "30min",
                  "1h",
                  "4h",
                  "12h",
                  "1d",
                  "1w",
                  "1M"
                ],
                "type": "string"
              }
            },
            {
              "name": "currency",
              "required": true,
              "in": "query",
              "description": "The currency format",
              "schema": {
                "default": "usd",
                "enum": [
                  "usd",
                  "native"
                ],
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 1000,
                "default": 100,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetCandleSticksResponse"
                  }
                }
              }
            }
          },
          "summary": "Get candlesticks for a pair address",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/nft/{network}/{address}/metadata": {
        "get": {
          "description": "Gets the contract level metadata (mint, standard, name, symbol, metaplex) for the given contract",
          "operationId": "getNFTMetadata",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            },
            {
              "name": "mediaItems",
              "required": false,
              "in": "query",
              "description": "Should return media items",
              "schema": {
                "default": true,
                "type": "boolean"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/NFTMetadata"
                  }
                }
              }
            }
          },
          "summary": "Get the global metadata for a given contract",
          "tags": [
            "NFT"
          ],
          "x-tag-sdk": "nft",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/nft": {
        "get": {
          "description": "Gets NFTs owned by the given address",
          "operationId": "getNFTs",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "nftMetadata",
              "required": false,
              "in": "query",
              "description": "Should return the full NFT metadata",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "mediaItems",
              "required": false,
              "in": "query",
              "description": "Should return media items",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "excludeSpam",
              "required": false,
              "in": "query",
              "description": "Should exclude spam NFTs",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "includeFungibleAssets",
              "required": false,
              "in": "query",
              "description": "Should include fungible assets (tokenStandard:1)",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/SPLNFT"
                    }
                  }
                }
              }
            }
          },
          "summary": "Gets NFTs owned by the given address",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/pairs/{pairAddress}/stats": {
        "get": {
          "description": "Gets the stats for a specific pair address",
          "operationId": "getPairStats",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "pairAddress",
              "required": true,
              "in": "path",
              "description": "The address of the pair to query",
              "schema": {
                "example": "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetPairStatsResponse"
                  }
                }
              }
            }
          },
          "summary": "Get stats for a pair address",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "pair",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/portfolio": {
        "get": {
          "description": "Gets all the native and token balances of the given address",
          "operationId": "getPortfolio",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "nftMetadata",
              "required": false,
              "in": "query",
              "description": "Should return the full NFT metadata",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "mediaItems",
              "required": false,
              "in": "query",
              "description": "Should return media items",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "excludeSpam",
              "required": false,
              "in": "query",
              "description": "Should exclude spam NFTs",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/Portfolio"
                  }
                }
              }
            }
          },
          "summary": "Gets the portfolio of the given address",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/pairs/{pairAddress}/snipers": {
        "get": {
          "description": "Get all snipers.",
          "operationId": "getSnipersByPairAddress",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "pairAddress",
              "required": true,
              "in": "path",
              "description": "The address of the pair to query",
              "schema": {
                "example": "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
                "type": "string"
              }
            },
            {
              "name": "blocksAfterCreation",
              "required": false,
              "in": "query",
              "schema": {
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetSnipersResponse"
                  }
                }
              }
            }
          },
          "summary": "Get snipers by pair address.",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "pair",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/tokens": {
        "get": {
          "description": "Gets token balances owned by the given address",
          "operationId": "getSPL",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "excludeSpam",
              "required": false,
              "in": "query",
              "description": "Should exclude spam tokens",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/SPLTokenBalance"
                    }
                  }
                }
              }
            }
          },
          "summary": "Gets token balances owned by the given address",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/pairs/{pairAddress}/swaps": {
        "get": {
          "description": "Get all swap related transactions (buy, sell, add liquidity & remove liquidity) for a specific pair address.",
          "operationId": "getSwapsByPairAddress",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "pairAddress",
              "required": true,
              "in": "path",
              "description": "The address of the pair to query",
              "schema": {
                "example": "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "order",
              "required": false,
              "in": "query",
              "description": "The order of items",
              "schema": {
                "default": "DESC",
                "enum": [
                  "ASC",
                  "DESC"
                ],
                "type": "string"
              }
            },
            {
              "name": "fromDate",
              "required": false,
              "in": "query",
              "description": "The starting date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "toDate",
              "required": false,
              "in": "query",
              "description": "The ending date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "transactionTypes",
              "required": false,
              "in": "query",
              "description": "Transaction types to fetch. Possible values: 'buy', 'sell', 'addLiquidity' or 'removeLiquidity' separated by comma",
              "schema": {
                "default": "buy,sell,addLiquidity,removeLiquidity",
                "example": "buy,sell,addLiquidity,removeLiquidity",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetSwapsByPairAddressResponse"
                  }
                }
              }
            }
          },
          "summary": "Get all swap related transactions (buy, sell, add liquidity & remove liquidity)",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "pair",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/swaps": {
        "get": {
          "description": "Get all swap related transactions (buy, sell) for a specific token address.",
          "operationId": "getSwapsByTokenAddress",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "fromDate",
              "required": false,
              "in": "query",
              "description": "The starting date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "toDate",
              "required": false,
              "in": "query",
              "description": "The ending date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "order",
              "required": false,
              "in": "query",
              "description": "The order of the results, in ascending (ASC) or descending (DESC).",
              "schema": {
                "default": "DESC",
                "example": "DESC",
                "enum": [
                  "ASC",
                  "DESC"
                ],
                "type": "string"
              }
            },
            {
              "name": "transactionTypes",
              "required": false,
              "in": "query",
              "description": "Transaction types to fetch. Possible values: 'buy','sell' or both separated by comma",
              "schema": {
                "default": "buy,sell",
                "example": "buy,sell",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetSwapsByTokenAddressResponseDto"
                  }
                }
              }
            }
          },
          "summary": "Get all swap related transactions (buy, sell)",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/swaps": {
        "get": {
          "description": "Get all swap related transactions (buy, sell) for a specific wallet address.",
          "operationId": "getSwapsByWalletAddress",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "order",
              "required": false,
              "in": "query",
              "description": "The order of items",
              "schema": {
                "default": "DESC",
                "enum": [
                  "ASC",
                  "DESC"
                ],
                "type": "string"
              }
            },
            {
              "name": "fromDate",
              "required": false,
              "in": "query",
              "description": "The starting date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "toDate",
              "required": false,
              "in": "query",
              "description": "The ending date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "transactionTypes",
              "required": false,
              "in": "query",
              "description": "Transaction types to fetch. Possible values: 'buy','sell' or both separated by comma",
              "schema": {
                "default": "buy,sell",
                "example": "buy,sell",
                "type": "string"
              }
            },
            {
              "name": "tokenAddress",
              "required": false,
              "in": "query",
              "description": "Token address to get transactions for",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetSwapsByWalletAddressResponseDto"
                  }
                }
              }
            }
          },
          "summary": "Get all swap related transactions (buy, sell) for a specific wallet address.",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/metadata": {
        "get": {
          "description": "Get the global token metadata for a given network and contract (mint, standard, name, symbol, metaplex).",
          "operationId": "getTokenMetadata",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "default": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/TokenMetadata"
                  }
                }
              }
            }
          },
          "summary": "Get Token metadata",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/pairs": {
        "get": {
          "description": "Get the supported pairs for a specific token address.",
          "operationId": "getTokenPairs",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 50,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/SupportedPairResponse"
                  }
                }
              }
            }
          },
          "summary": "Get token pairs by address",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/price": {
        "get": {
          "description": "Gets the token price (usd and native) for a given contract address and network.",
          "operationId": "getTokenPrice",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "default": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/SPLTokenPrice"
                  }
                }
              }
            }
          },
          "summary": "Get token price",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/prices": {
        "post": {
          "description": "Gets the token price (usd and native) for a given contract address and network.",
          "operationId": "getMultipleTokenPrices",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/GetMultipleTokenPricesRequest"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "default": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/SPLTokenPrice"
                    }
                  }
                }
              }
            }
          },
          "summary": "Get token price",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/balance": {
        "get": {
          "description": "Gets native balance owned by the given address",
          "operationId": "balance",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/NativeBalance"
                  }
                }
              }
            }
          },
          "summary": "Gets native balance owned by the given address",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/exchange/{exchange}/new": {
        "get": {
          "description": "Get the list of new tokens by given exchange.",
          "operationId": "getNewTokensByExchange",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "exchange",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/NewTokensResponse"
                  }
                }
              }
            }
          },
          "summary": "Get new tokens by exchange",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/exchange/{exchange}/bonding": {
        "get": {
          "description": "Get the list of bonding tokens by given exchange.",
          "operationId": "getBondingTokensByExchange",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "exchange",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/BondingTokensResponse"
                  }
                }
              }
            }
          },
          "summary": "Get bonding tokens by exchange",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/exchange/{exchange}/graduated": {
        "get": {
          "description": "Get the list of graduated tokens by given exchange.",
          "operationId": "getGraduatedTokensByExchange",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "exchange",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GraduatedTokensResponse"
                  }
                }
              }
            }
          },
          "summary": "Get graduated tokens by exchange",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/holders/{address}/historical": {
        "get": {
          "operationId": "getHistoricalTokenHolders",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "timeFrame",
              "required": true,
              "in": "query",
              "description": "The interval of the holders data",
              "schema": {
                "default": "1min",
                "enum": [
                  "1min",
                  "5min",
                  "10min",
                  "30min",
                  "1h",
                  "4h",
                  "12h",
                  "1d",
                  "1w",
                  "1m"
                ],
                "type": "string"
              }
            },
            {
              "name": "fromDate",
              "required": true,
              "in": "query",
              "description": "The starting date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "toDate",
              "required": true,
              "in": "query",
              "description": "The ending date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page depending on the plan",
              "schema": {
                "default": 100,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetHistoricalHoldersResponseDto"
                  }
                }
              }
            }
          },
          "summary": "Get token holders overtime for a given tokens",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/bonding-status": {
        "get": {
          "description": "Get the token bonding status for a given network and contract (if relevant).",
          "operationId": "getTokenBondingStatus",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "default": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/TokenBondingStatus"
                  }
                }
              }
            }
          },
          "summary": "Get Token Bonding Status",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/holders/{address}": {
        "get": {
          "operationId": "getTokenHolders",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetTokenHoldersResponseDto"
                  }
                }
              }
            }
          },
          "summary": "Get the summary of holders for a given token token.",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/top-holders": {
        "get": {
          "operationId": "getTopHolders",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "type": "string"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetTopHoldersResponseDto"
                  }
                }
              }
            }
          },
          "summary": "Get paginated top holders for a given token.",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      }
    },
    "components": {
      "securitySchemes": {
        "ApiKeyAuth": {
          "type": "apiKey",
          "in": "header",
          "name": "X-Api-Key"
        }
      },
      "schemas": {
        "SupportedPairStatsResponse": {
          "type": "object",
          "properties": {
            "totalLiquidityUsd": {
              "type": "number"
            },
            "totalActivePairs": {
              "type": "number"
            },
            "totalActiveDexes": {
              "type": "number"
            },
            "totalSwaps": {
              "$ref": "#/components/schemas/PairStats"
            },
            "totalVolume": {
              "$ref": "#/components/schemas/PairStats"
            },
            "totalBuyVolume": {
              "$ref": "#/components/schemas/PairStats"
            },
            "totalSellVolume": {
              "$ref": "#/components/schemas/PairStats"
            },
            "totalBuyers": {
              "$ref": "#/components/schemas/PairStats"
            },
            "totalSellers": {
              "$ref": "#/components/schemas/PairStats"
            }
          },
          "required": [
            "totalLiquidityUsd",
            "totalActivePairs",
            "totalActiveDexes",
            "totalSwaps",
            "totalVolume",
            "totalBuyVolume",
            "totalSellVolume",
            "totalBuyers",
            "totalSellers"
          ]
        },
        "GetCandleSticksResponse": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "nullable": true,
              "description": "The cursor to the next page"
            },
            "page": {
              "type": "number",
              "description": "The page number"
            },
            "pairAddress": {
              "type": "string",
              "description": "The pair address"
            },
            "tokenAddress": {
              "type": "string",
              "nullable": true,
              "description": "The token address"
            },
            "timeframe": {
              "type": "string",
              "enum": [
                "1s",
                "10s",
                "30s",
                "1min",
                "5min",
                "10min",
                "30min",
                "1h",
                "4h",
                "12h",
                "1d",
                "1w",
                "1M"
              ],
              "description": "The interval of the candle stick",
              "default": "1min"
            },
            "currency": {
              "type": "string",
              "default": "usd",
              "enum": [
                "usd",
                "native"
              ],
              "description": "The currency format"
            },
            "result": {
              "description": "An array of candlesticks",
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/Ohlcv"
              }
            }
          },
          "required": [
            "page",
            "pairAddress",
            "tokenAddress",
            "timeframe",
            "currency"
          ]
        },
        "NFTMetadata": {
          "type": "object",
          "properties": {
            "mint": {
              "type": "string"
            },
            "address": {
              "type": "string"
            },
            "standard": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "symbol": {
              "type": "string"
            },
            "tokenStandard": {
              "type": "number",
              "nullable": true
            },
            "description": {
              "type": "string",
              "nullable": true
            },
            "imageOriginalUrl": {
              "type": "string",
              "nullable": true
            },
            "externalUrl": {
              "type": "string",
              "nullable": true
            },
            "metadataOriginalUrl": {
              "type": "string",
              "nullable": true
            },
            "totalSupply": {
              "type": "string"
            },
            "metaplex": {
              "$ref": "#/components/schemas/NFTMetaplex"
            },
            "attributes": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/NFTMetadataAttributeDto"
              }
            },
            "contract": {
              "$ref": "#/components/schemas/NFTMetadataContractDto"
            },
            "collection": {
              "$ref": "#/components/schemas/NFTMetadataCollectionDto"
            },
            "firstCreated": {
              "$ref": "#/components/schemas/NFTMetadataFirstCreatedDto"
            },
            "creators": {
              "nullable": true,
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/NFTMetadataCreatorDto"
              }
            },
            "properties": {
              "type": "object",
              "nullable": true
            },
            "media": {
              "nullable": true,
              "allOf": [
                {
                  "$ref": "#/components/schemas/Media"
                }
              ]
            },
            "possibleSpam": {
              "type": "boolean"
            }
          },
          "required": [
            "mint",
            "address",
            "standard",
            "name",
            "symbol",
            "tokenStandard",
            "description",
            "imageOriginalUrl",
            "externalUrl",
            "metadataOriginalUrl",
            "totalSupply",
            "metaplex",
            "attributes",
            "contract",
            "collection",
            "firstCreated",
            "creators",
            "properties",
            "media",
            "possibleSpam"
          ]
        },
        "SPLNFT": {
          "type": "object",
          "properties": {
            "associatedTokenAddress": {
              "type": "string"
            },
            "mint": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "symbol": {
              "type": "string"
            },
            "tokenStandard": {
              "type": "number",
              "nullable": true
            },
            "amount": {
              "type": "string"
            },
            "amountRaw": {
              "type": "string"
            },
            "decimals": {
              "type": "number"
            },
            "possibleSpam": {
              "type": "boolean"
            },
            "totalSupply": {
              "type": "string"
            },
            "attributes": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/NFTMetadataAttributeDto"
              }
            },
            "contract": {
              "$ref": "#/components/schemas/NFTMetadataContractDto"
            },
            "collection": {
              "$ref": "#/components/schemas/NFTMetadataCollectionDto"
            },
            "firstCreated": {
              "$ref": "#/components/schemas/NFTMetadataFirstCreatedDto"
            },
            "creators": {
              "nullable": true,
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/NFTMetadataCreatorDto"
              }
            },
            "properties": {
              "type": "object",
              "nullable": true
            },
            "media": {
              "nullable": true,
              "allOf": [
                {
                  "$ref": "#/components/schemas/Media"
                }
              ]
            }
          },
          "required": [
            "associatedTokenAddress",
            "mint",
            "name",
            "symbol",
            "tokenStandard",
            "amount",
            "amountRaw",
            "decimals",
            "possibleSpam"
          ]
        },
        "GetPairStatsResponse": {
          "type": "object",
          "properties": {
            "tokenAddress": {
              "type": "string",
              "description": "The token address"
            },
            "tokenName": {
              "type": "string",
              "nullable": true,
              "description": "The token name"
            },
            "tokenSymbol": {
              "type": "string",
              "nullable": true,
              "description": "The token symbol"
            },
            "tokenLogo": {
              "type": "string",
              "nullable": true,
              "description": "The token logo"
            },
            "pairCreated": {
              "type": "string",
              "nullable": true,
              "description": "The timestamp when pair is created"
            },
            "pairLabel": {
              "type": "string",
              "nullable": true,
              "description": "The pair label"
            },
            "pairAddress": {
              "type": "string",
              "description": "The pair address"
            },
            "exchange": {
              "type": "string",
              "nullable": true,
              "description": "The exchange name"
            },
            "exchangeAddress": {
              "type": "string",
              "description": "The exchange address"
            },
            "exchangeLogo": {
              "type": "string",
              "nullable": true,
              "description": "The exchange logo"
            },
            "exchangeUrl": {
              "type": "string",
              "nullable": true,
              "description": "The exchange url"
            },
            "currentUsdPrice": {
              "type": "string",
              "nullable": true,
              "description": "The current usd price of the token"
            },
            "currentNativePrice": {
              "type": "string",
              "nullable": true,
              "description": "The current native price of the token"
            },
            "totalLiquidityUsd": {
              "type": "string",
              "nullable": true,
              "description": "The total liquidity of the pair in USD"
            },
            "pricePercentChange": {
              "description": "The price percent change stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "liquidityPercentChange": {
              "description": "The liquidity change stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "buys": {
              "description": "The total buys stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "sells": {
              "description": "The total sells stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "totalVolume": {
              "description": "The total volume stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "buyVolume": {
              "description": "The total buy volume stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "sellVolume": {
              "description": "The total sell volume stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "buyers": {
              "description": "The total unique buyers stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            },
            "sellers": {
              "description": "The total unique sellers stats",
              "allOf": [
                {
                  "$ref": "#/components/schemas/PairStats"
                }
              ]
            }
          },
          "required": [
            "tokenAddress",
            "tokenName",
            "tokenSymbol",
            "tokenLogo",
            "pairCreated",
            "pairLabel",
            "pairAddress",
            "exchange",
            "exchangeAddress",
            "exchangeLogo",
            "exchangeUrl",
            "currentUsdPrice",
            "currentNativePrice",
            "totalLiquidityUsd",
            "pricePercentChange",
            "liquidityPercentChange",
            "buys",
            "sells",
            "totalVolume",
            "buyVolume",
            "sellVolume",
            "buyers",
            "sellers"
          ]
        },
        "Portfolio": {
          "type": "object",
          "properties": {
            "nativeBalance": {
              "$ref": "#/components/schemas/NativeBalance"
            },
            "nfts": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SPLNFT"
              }
            },
            "tokens": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SPLTokenBalance"
              }
            }
          },
          "required": [
            "nativeBalance",
            "nfts",
            "tokens"
          ]
        },
        "GetSnipersResponse": {
          "type": "object",
          "properties": {
            "transactionHash": {
              "type": "string"
            },
            "blockNumber": {
              "type": "number"
            },
            "blockTimestamp": {
              "type": "string"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SniperResponse"
              }
            }
          },
          "required": [
            "transactionHash",
            "blockNumber",
            "blockTimestamp",
            "result"
          ]
        },
        "SPLTokenBalance": {
          "type": "object",
          "properties": {
            "associatedTokenAddress": {
              "type": "string"
            },
            "mint": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "symbol": {
              "type": "string"
            },
            "tokenStandard": {
              "type": "number",
              "nullable": true
            },
            "amount": {
              "type": "string"
            },
            "amountRaw": {
              "type": "string"
            },
            "decimals": {
              "type": "number"
            },
            "logo": {
              "type": "string",
              "nullable": true
            },
            "isVerifiedContract": {
              "type": "boolean"
            },
            "possibleSpam": {
              "type": "boolean"
            }
          },
          "required": [
            "associatedTokenAddress",
            "mint",
            "name",
            "symbol",
            "tokenStandard",
            "amount",
            "amountRaw",
            "decimals",
            "logo",
            "isVerifiedContract",
            "possibleSpam"
          ]
        },
        "GetSwapsByPairAddressResponse": {
          "type": "object",
          "properties": {
            "page": {
              "type": "number",
              "example": 1
            },
            "pageSize": {
              "type": "number",
              "example": 100
            },
            "cursor": {
              "type": "string",
              "nullable": true,
              "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...kJ8E_653QrA4Q8zb_9OCn6opE9aBo8PjqLeQU_VCaaw"
            },
            "exchangeName": {
              "type": "string",
              "nullable": true,
              "example": "Raydium AMM v4"
            },
            "exchangeLogo": {
              "type": "string",
              "nullable": true,
              "example": "https://entities-logos.s3.amazonaws.com/raydium.png"
            },
            "exchangeAddress": {
              "type": "string",
              "nullable": true,
              "example": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
            },
            "pairLabel": {
              "type": "string",
              "nullable": true,
              "example": "BREAD/SOL"
            },
            "pairAddress": {
              "type": "string",
              "nullable": true,
              "example": "ALeyWh7zN979ZHUWY6YTMJC8wWowzdYqi8RRPRyB3LAd"
            },
            "baseToken": {
              "$ref": "#/components/schemas/SwapsByPairAddressTokenMetadata"
            },
            "quoteToken": {
              "$ref": "#/components/schemas/SwapsByPairAddressTokenMetadata"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SwapTransaction"
              }
            }
          },
          "required": [
            "page",
            "pageSize",
            "cursor",
            "exchangeName",
            "exchangeLogo",
            "exchangeAddress",
            "pairLabel",
            "pairAddress",
            "baseToken",
            "quoteToken",
            "result"
          ]
        },
        "GetSwapsByTokenAddressResponseDto": {
          "type": "object",
          "properties": {
            "page": {
              "type": "number",
              "example": 1
            },
            "pageSize": {
              "type": "number",
              "example": 100
            },
            "cursor": {
              "type": "string",
              "nullable": true,
              "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...Caaw"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SwapTransactionForWalletAndTokenDto"
              }
            }
          },
          "required": [
            "page",
            "pageSize",
            "cursor",
            "result"
          ]
        },
        "GetSwapsByWalletAddressResponseDto": {
          "type": "object",
          "properties": {
            "page": {
              "type": "number"
            },
            "pageSize": {
              "type": "number"
            },
            "cursor": {
              "type": "string",
              "nullable": true
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SwapTransactionForWalletAndTokenDto"
              }
            }
          },
          "required": [
            "page",
            "pageSize",
            "cursor",
            "result"
          ]
        },
        "TokenMetadata": {
          "type": "object",
          "properties": {
            "mint": {
              "type": "string"
            },
            "standard": {
              "type": "string"
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "symbol": {
              "type": "string",
              "nullable": true
            },
            "logo": {
              "type": "string",
              "nullable": true
            },
            "decimals": {
              "type": "string",
              "nullable": true
            },
            "tokenStandard": {
              "type": "number",
              "nullable": true
            },
            "totalSupply": {
              "type": "string",
              "nullable": true
            },
            "totalSupplyFormatted": {
              "type": "string",
              "nullable": true
            },
            "fullyDilutedValue": {
              "type": "string",
              "nullable": true
            },
            "metaplex": {
              "$ref": "#/components/schemas/Metaplex"
            },
            "links": {
              "type": "object",
              "nullable": true
            },
            "description": {
              "type": "string",
              "nullable": true
            },
            "isVerifiedContract": {
              "type": "boolean",
              "nullable": true
            },
            "possibleSpam": {
              "type": "boolean"
            }
          },
          "required": [
            "mint",
            "standard",
            "name",
            "symbol",
            "logo",
            "decimals",
            "tokenStandard",
            "totalSupply",
            "totalSupplyFormatted",
            "fullyDilutedValue",
            "metaplex",
            "links",
            "description",
            "isVerifiedContract",
            "possibleSpam"
          ]
        },
        "SupportedPairResponse": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "nullable": true
            },
            "pageSize": {
              "type": "number"
            },
            "page": {
              "type": "number"
            },
            "pairs": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SupportedPairInfo"
              }
            }
          },
          "required": [
            "cursor",
            "pageSize",
            "page",
            "pairs"
          ]
        },
        "SPLTokenPrice": {
          "type": "object",
          "properties": {
            "tokenAddress": {
              "type": "string"
            },
            "pairAddress": {
              "type": "string"
            },
            "nativePrice": {
              "$ref": "#/components/schemas/SPLNativePrice"
            },
            "usdPrice": {
              "type": "number"
            },
            "exchangeAddress": {
              "type": "string"
            },
            "exchangeName": {
              "type": "string"
            },
            "logo": {
              "type": "string",
              "nullable": true
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "symbol": {
              "type": "string",
              "nullable": true
            },
            "usdPrice24h": {
              "type": "number",
              "nullable": true
            },
            "usdPrice24hrUsdChange": {
              "type": "number",
              "nullable": true
            },
            "usdPrice24hrPercentChange": {
              "type": "number",
              "nullable": true
            },
            "isVerifiedContract": {
              "type": "boolean",
              "nullable": true
            }
          }
        },
        "GetMultipleTokenPricesRequest": {
          "type": "object",
          "properties": {
            "addresses": {
              "minItems": 1,
              "maxItems": 100,
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "addresses"
          ]
        },
        "NativeBalance": {
          "type": "object",
          "properties": {
            "solana": {
              "type": "string"
            },
            "lamports": {
              "type": "string"
            }
          },
          "required": [
            "solana",
            "lamports"
          ]
        },
        "NewTokensResponse": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "nullable": true
            },
            "pageSize": {
              "type": "number"
            },
            "page": {
              "type": "number"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/NewTokenDto"
              }
            }
          },
          "required": [
            "cursor",
            "pageSize",
            "page",
            "result"
          ]
        },
        "BondingTokensResponse": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "nullable": true
            },
            "pageSize": {
              "type": "number"
            },
            "page": {
              "type": "number"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/BondingTokenDto"
              }
            }
          },
          "required": [
            "cursor",
            "pageSize",
            "page",
            "result"
          ]
        },
        "GraduatedTokensResponse": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "nullable": true
            },
            "pageSize": {
              "type": "number"
            },
            "page": {
              "type": "number"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/GraduatedTokenDto"
              }
            }
          },
          "required": [
            "cursor",
            "pageSize",
            "page",
            "result"
          ]
        },
        "GetHistoricalHoldersResponseDto": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "description": "The cursor to the next page"
            },
            "result": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/HolderTimelineItemDto"
              }
            },
            "page": {
              "type": "number",
              "description": "The current page number"
            }
          },
          "required": [
            "result",
            "page"
          ]
        },
        "TokenBondingStatus": {
          "type": "object",
          "properties": {
            "mint": {
              "type": "string",
              "example": "So11111111111111111111111111111111111111112"
            },
            "bondingProgress": {
              "type": "number",
              "example": 50
            },
            "graduatedAt": {
              "type": "string",
              "example": "2024-11-28T09:44:55.000Z"
            }
          },
          "required": [
            "mint",
            "bondingProgress",
            "graduatedAt"
          ]
        },
        "GetTokenHoldersResponseDto": {
          "type": "object",
          "properties": {
            "totalHolders": {
              "type": "number",
              "example": 5000
            },
            "holdersByAcquisition": {
              "$ref": "#/components/schemas/HoldersByAcquisitionDto"
            },
            "holderChange": {
              "$ref": "#/components/schemas/HolderChangeSummaryDTO"
            },
            "holderDistribution": {
              "$ref": "#/components/schemas/HolderDistributionDto"
            },
            "holderSupply": {
              "$ref": "#/components/schemas/HolderSupplyDto"
            }
          },
          "required": [
            "totalHolders",
            "holdersByAcquisition",
            "holderChange",
            "holderDistribution",
            "holderSupply"
          ]
        },
        "GetTopHoldersResponseDto": {
          "type": "object",
          "properties": {
            "result": {
              "default": [],
              "description": "The list of top holders",
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/TopHolderResultDto"
              }
            },
            "cursor": {
              "type": "string",
              "description": "The cursor to fetch the next page"
            },
            "page": {
              "type": "number",
              "description": "The page number"
            },
            "pageSize": {
              "type": "number",
              "description": "The page size"
            },
            "totalSupply": {
              "type": "string",
              "description": "The total supply of the token"
            }
          },
          "required": [
            "result",
            "page",
            "pageSize",
            "totalSupply"
          ]
        },
        "PairStats": {
          "type": "object",
          "properties": {
            "5min": {
              "type": "number",
              "nullable": true,
              "description": "The 5 minutes timeframe data"
            },
            "1h": {
              "type": "number",
              "nullable": true,
              "description": "The 1 hour timeframe data"
            },
            "4h": {
              "type": "number",
              "nullable": true,
              "description": "The 4 hours timeframe data"
            },
            "24h": {
              "type": "number",
              "nullable": true,
              "description": "The 24 hours timeframe data"
            }
          },
          "required": [
            "5min",
            "1h",
            "4h",
            "24h"
          ]
        },
        "Ohlcv": {
          "type": "object",
          "properties": {
            "timestamp": {
              "type": "string",
              "nullable": true,
              "description": ""
            },
            "open": {
              "type": "number",
              "nullable": true,
              "description": ""
            },
            "close": {
              "type": "number",
              "nullable": true,
              "description": ""
            },
            "high": {
              "type": "number",
              "nullable": true,
              "description": ""
            },
            "low": {
              "type": "number",
              "nullable": true,
              "description": ""
            },
            "volume": {
              "type": "number",
              "nullable": true,
              "description": ""
            },
            "trades": {
              "type": "number",
              "description": ""
            }
          },
          "required": [
            "timestamp",
            "open",
            "close",
            "high",
            "low",
            "volume",
            "trades"
          ]
        },
        "NFTMetaplex": {
          "type": "object",
          "properties": {
            "metadataUri": {
              "type": "string",
              "nullable": true
            },
            "masterEdition": {
              "type": "boolean"
            },
            "isMutable": {
              "type": "boolean"
            },
            "primarySaleHappened": {
              "type": "number"
            },
            "sellerFeeBasisPoints": {
              "type": "number"
            },
            "updateAuthority": {
              "type": "string",
              "nullable": true
            }
          },
          "required": [
            "metadataUri",
            "masterEdition",
            "isMutable",
            "primarySaleHappened",
            "sellerFeeBasisPoints",
            "updateAuthority"
          ]
        },
        "NFTMetadataAttributeDto": {
          "type": "object",
          "properties": {
            "traitType": {
              "type": "string",
              "nullable": true
            },
            "value": {
              "type": "object"
            }
          },
          "required": [
            "traitType",
            "value"
          ]
        },
        "NFTMetadataContractDto": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "nullable": true
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "symbol": {
              "type": "string",
              "nullable": true
            }
          },
          "required": [
            "type",
            "name",
            "symbol"
          ]
        },
        "NFTMetadataCollectionDto": {
          "type": "object",
          "properties": {
            "collectionAddress": {
              "type": "string",
              "nullable": true
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "description": {
              "type": "string",
              "nullable": true
            },
            "imageOriginalUrl": {
              "type": "string",
              "nullable": true
            },
            "externalUrl": {
              "type": "string",
              "nullable": true
            },
            "metaplexMint": {
              "type": "string",
              "nullable": true
            },
            "sellerFeeBasisPoints": {
              "type": "number",
              "nullable": true
            }
          },
          "required": [
            "collectionAddress",
            "name",
            "description",
            "imageOriginalUrl",
            "externalUrl",
            "metaplexMint",
            "sellerFeeBasisPoints"
          ]
        },
        "NFTMetadataFirstCreatedDto": {
          "type": "object",
          "properties": {
            "mintTimestamp": {
              "type": "number",
              "nullable": true
            },
            "mintBlockNumber": {
              "type": "number",
              "nullable": true
            },
            "mintTransaction": {
              "type": "string",
              "nullable": true
            }
          },
          "required": [
            "mintTimestamp",
            "mintBlockNumber",
            "mintTransaction"
          ]
        },
        "NFTMetadataCreatorDto": {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "nullable": true
            },
            "share": {
              "type": "number",
              "nullable": true
            },
            "verified": {
              "type": "boolean",
              "nullable": true
            }
          },
          "required": [
            "address",
            "share",
            "verified"
          ]
        },
        "Media": {
          "type": "object",
          "properties": {
            "mimetype": {
              "type": "string"
            },
            "category": {
              "type": "string"
            },
            "originalMediaUrl": {
              "type": "string"
            },
            "status": {
              "type": "string"
            },
            "updatedAt": {
              "type": "string"
            },
            "mediaCollection": {
              "$ref": "#/components/schemas/MediaCollection"
            }
          }
        },
        "SniperResponse": {
          "type": "object",
          "properties": {
            "walletAddress": {
              "type": "string"
            },
            "totalTokensSniped": {
              "type": "number"
            },
            "totalSnipedUsd": {
              "type": "number"
            },
            "totalSnipedTransactions": {
              "type": "number"
            },
            "snipedTransactions": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SniperTransaction"
              }
            },
            "totalTokensSold": {
              "type": "number"
            },
            "totalSoldUsd": {
              "type": "number"
            },
            "totalSellTransactions": {
              "type": "number"
            },
            "sellTransactions": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/SniperTransaction"
              }
            },
            "currentBalance": {
              "type": "number"
            },
            "currentBalanceUsdValue": {
              "type": "number"
            },
            "realizedProfitPercentage": {
              "type": "number"
            },
            "realizedProfitUsd": {
              "type": "number"
            }
          },
          "required": [
            "walletAddress",
            "totalTokensSniped",
            "totalSnipedUsd",
            "totalSnipedTransactions",
            "snipedTransactions",
            "totalTokensSold",
            "totalSoldUsd",
            "totalSellTransactions",
            "sellTransactions",
            "currentBalance",
            "currentBalanceUsdValue",
            "realizedProfitPercentage",
            "realizedProfitUsd"
          ]
        },
        "SwapsByPairAddressTokenMetadata": {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "nullable": true,
              "example": "madHpjRn6bd8t78Rsy7NuSuNwWa2HU8ByPobZprHbHv"
            },
            "name": {
              "type": "string",
              "nullable": true,
              "example": "MAD"
            },
            "symbol": {
              "type": "string",
              "nullable": true,
              "example": "MAD"
            },
            "logo": {
              "type": "string",
              "nullable": true,
              "example": "https://ipfs.io/ipfs/QmeCR6o1FrYjczPdDDDm4623usKksjj9BQLu89WqV8jFZW?filename=MAD.jpg"
            },
            "decimals": {
              "type": "string",
              "nullable": true,
              "example": "18"
            }
          },
          "required": [
            "address",
            "name",
            "symbol",
            "logo",
            "decimals"
          ]
        },
        "SwapTransaction": {
          "type": "object",
          "properties": {
            "transactionHash": {
              "type": "string",
              "nullable": true,
              "example": "3o9NfCBWaDEb8JLJGdp8tfWwXURNokanCvUJf9A9f5nFqmZkRvWcfhkek4t47UhRDSGKHsSzi8MBusin8H7x7YYD"
            },
            "transactionType": {
              "type": "string",
              "nullable": true,
              "example": "sell"
            },
            "transactionIndex": {
              "type": "number",
              "nullable": true,
              "example": 250
            },
            "subCategory": {
              "type": "string",
              "nullable": true,
              "example": "sellAll"
            },
            "blockTimestamp": {
              "type": "string",
              "nullable": true,
              "example": "2024-11-28T09:44:55.000Z"
            },
            "blockNumber": {
              "type": "number",
              "example": 304108120
            },
            "walletAddress": {
              "type": "string",
              "nullable": true,
              "example": "A8GVZWGMxRAouFQymPoMKx527JhHKrBRuqFx7NET4j22"
            },
            "baseTokenAmount": {
              "type": "string",
              "nullable": true,
              "example": "199255.444466200"
            },
            "quoteTokenAmount": {
              "type": "string",
              "nullable": true,
              "example": "0.007374998"
            },
            "baseTokenPriceUsd": {
              "type": "number",
              "example": 0.000008794
            },
            "quoteTokenPriceUsd": {
              "type": "number",
              "example": 237.60336565
            },
            "baseQuotePrice": {
              "type": "string",
              "nullable": true,
              "example": "0.0000000370127"
            },
            "totalValueUsd": {
              "type": "number",
              "example": 1.752324346
            }
          },
          "required": [
            "transactionHash",
            "transactionType",
            "transactionIndex",
            "subCategory",
            "blockTimestamp",
            "blockNumber",
            "walletAddress",
            "baseTokenAmount",
            "quoteTokenAmount",
            "baseTokenPriceUsd",
            "quoteTokenPriceUsd",
            "baseQuotePrice",
            "totalValueUsd"
          ]
        },
        "SwapTransactionForWalletAndTokenDto": {
          "type": "object",
          "properties": {
            "transactionHash": {
              "type": "string",
              "example": "0xafc66b9b1802618f560be5244395f0fc0b95a1f1fdeee7a206acbb546c9e8a72"
            },
            "transactionIndex": {
              "type": "number",
              "example": 5
            },
            "transactionType": {
              "type": "string",
              "example": "buy"
            },
            "blockNumber": {
              "type": "number",
              "example": 12345678
            },
            "blockTimestamp": {
              "type": "string",
              "example": "2024-11-21T09:22:28.000Z"
            },
            "subCategory": {
              "type": "string",
              "nullable": true,
              "example": "ACCUMULATION"
            },
            "walletAddress": {
              "type": "string",
              "example": "0x1c584a6baecb7c5d51caa0ef3a579e08bd49d4e5"
            },
            "pairAddress": {
              "type": "string",
              "nullable": true,
              "example": "0xdded227d71a096c6b5d87807c1b5c456771aaa94"
            },
            "pairLabel": {
              "type": "string",
              "nullable": true,
              "example": "USDC/WETH"
            },
            "exchangeAddress": {
              "type": "string",
              "nullable": true,
              "example": "0x1080ee857d165186af7f8d63e8ec510c28a6d1ea"
            },
            "exchangeName": {
              "type": "string",
              "nullable": true,
              "example": "Uniswap"
            },
            "exchangeLogo": {
              "type": "string",
              "nullable": true,
              "example": "https://logo.moralis.io/0xe708_0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f_769a0b766bd3d6d1830f0a95d7b3e313"
            },
            "baseToken": {
              "type": "string",
              "nullable": true,
              "example": "ETH"
            },
            "quoteToken": {
              "type": "string",
              "nullable": true,
              "example": "USDT"
            },
            "bought": {
              "nullable": true,
              "example": {
                "address": "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
                "name": "Wrapped Ether",
                "symbol": "SYM",
                "logo": "https://example.com/logo-token1.png",
                "amount": "0.000014332429005002",
                "usdPrice": 3148.1828278180296,
                "usdAmount": 1230,
                "tokenType": "token1"
              },
              "allOf": [
                {
                  "$ref": "#/components/schemas/SwapTokenMetadataDto"
                }
              ]
            },
            "sold": {
              "nullable": true,
              "example": {
                "address": "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
                "name": "USDC",
                "symbol": "SYM",
                "logo": "https://example.com/logo-token2.png",
                "amount": "1000",
                "usdPrice": 0.9999999999999986,
                "usdAmount": -0.045138999999999936,
                "tokenType": "token0"
              },
              "allOf": [
                {
                  "$ref": "#/components/schemas/SwapTokenMetadataDto"
                }
              ]
            },
            "baseQuotePrice": {
              "type": "string",
              "nullable": true,
              "example": "0.01"
            },
            "totalValueUsd": {
              "type": "number",
              "nullable": true,
              "example": 1230
            }
          },
          "required": [
            "transactionHash",
            "transactionIndex",
            "transactionType",
            "blockNumber",
            "blockTimestamp",
            "subCategory",
            "walletAddress",
            "pairAddress",
            "pairLabel",
            "exchangeAddress",
            "exchangeName",
            "exchangeLogo",
            "baseToken",
            "quoteToken",
            "bought",
            "sold",
            "baseQuotePrice",
            "totalValueUsd"
          ]
        },
        "Metaplex": {
          "type": "object",
          "properties": {
            "metadataUri": {
              "type": "string",
              "nullable": true
            },
            "masterEdition": {
              "type": "boolean"
            },
            "isMutable": {
              "type": "boolean"
            },
            "primarySaleHappened": {
              "type": "number"
            },
            "sellerFeeBasisPoints": {
              "type": "number"
            },
            "updateAuthority": {
              "type": "string",
              "nullable": true
            }
          },
          "required": [
            "metadataUri",
            "masterEdition",
            "isMutable",
            "primarySaleHappened",
            "sellerFeeBasisPoints",
            "updateAuthority"
          ]
        },
        "SupportedPairInfo": {
          "type": "object",
          "properties": {
            "exchangeAddress": {
              "type": "string"
            },
            "exchangeName": {
              "type": "string",
              "nullable": true
            },
            "exchangeLogo": {
              "type": "string",
              "nullable": true
            },
            "pairAddress": {
              "type": "string"
            },
            "pairLabel": {
              "type": "string",
              "nullable": true
            },
            "usdPrice": {
              "type": "number",
              "nullable": true
            },
            "usdPrice24hrPercentChange": {
              "type": "number",
              "nullable": true
            },
            "usdPrice24hrUsdChange": {
              "type": "number",
              "nullable": true
            },
            "volume24hrNative": {
              "type": "number",
              "nullable": true
            },
            "volume24hrUsd": {
              "type": "number",
              "nullable": true
            },
            "liquidityUsd": {
              "type": "number",
              "nullable": true
            },
            "inactivePair": {
              "type": "boolean",
              "nullable": true
            },
            "baseToken": {
              "type": "string"
            },
            "quoteToken": {
              "type": "string"
            },
            "pair": {
              "type": "array",
              "items": {
                "$ref": "#/components/schemas/PairInfo"
              }
            }
          },
          "required": [
            "exchangeAddress",
            "exchangeName",
            "exchangeLogo",
            "pairAddress",
            "pairLabel",
            "usdPrice",
            "usdPrice24hrPercentChange",
            "usdPrice24hrUsdChange",
            "volume24hrNative",
            "volume24hrUsd",
            "liquidityUsd",
            "inactivePair",
            "baseToken",
            "quoteToken",
            "pair"
          ]
        },
        "SPLNativePrice": {
          "type": "object",
          "properties": {
            "value": {
              "type": "string"
            },
            "decimals": {
              "type": "number"
            },
            "name": {
              "type": "string"
            },
            "symbol": {
              "type": "string"
            }
          },
          "required": [
            "value",
            "decimals",
            "name",
            "symbol"
          ]
        },
        "NewTokenDto": {
          "type": "object",
          "properties": {
            "tokenAddress": {
              "type": "string"
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "symbol": {
              "type": "string",
              "nullable": true
            },
            "logo": {
              "type": "string",
              "nullable": true
            },
            "decimals": {
              "type": "string",
              "nullable": true
            },
            "priceNative": {
              "type": "string",
              "nullable": true
            },
            "priceUsd": {
              "type": "string",
              "nullable": true
            },
            "liquidity": {
              "type": "string",
              "nullable": true
            },
            "fullyDilutedValuation": {
              "type": "string",
              "nullable": true
            },
            "createdAt": {
              "type": "string",
              "nullable": false,
              "example": "2024-11-28T09:44:55.000Z"
            }
          },
          "required": [
            "tokenAddress",
            "name",
            "symbol",
            "logo",
            "decimals",
            "priceNative",
            "priceUsd",
            "liquidity",
            "fullyDilutedValuation",
            "createdAt"
          ]
        },
        "BondingTokenDto": {
          "type": "object",
          "properties": {
            "tokenAddress": {
              "type": "string"
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "symbol": {
              "type": "string",
              "nullable": true
            },
            "logo": {
              "type": "string",
              "nullable": true
            },
            "decimals": {
              "type": "string",
              "nullable": true
            },
            "priceNative": {
              "type": "string",
              "nullable": true
            },
            "priceUsd": {
              "type": "string",
              "nullable": true
            },
            "liquidity": {
              "type": "string",
              "nullable": true
            },
            "fullyDilutedValuation": {
              "type": "string",
              "nullable": true
            },
            "bondingCurveProgress": {
              "type": "number"
            }
          },
          "required": [
            "tokenAddress",
            "name",
            "symbol",
            "logo",
            "decimals",
            "priceNative",
            "priceUsd",
            "liquidity",
            "fullyDilutedValuation"
          ]
        },
        "GraduatedTokenDto": {
          "type": "object",
          "properties": {
            "tokenAddress": {
              "type": "string"
            },
            "name": {
              "type": "string",
              "nullable": true
            },
            "symbol": {
              "type": "string",
              "nullable": true
            },
            "logo": {
              "type": "string",
              "nullable": true
            },
            "decimals": {
              "type": "string",
              "nullable": true
            },
            "priceNative": {
              "type": "string",
              "nullable": true
            },
            "priceUsd": {
              "type": "string",
              "nullable": true
            },
            "liquidity": {
              "type": "string",
              "nullable": true
            },
            "fullyDilutedValuation": {
              "type": "string",
              "nullable": true
            },
            "graduatedAt": {
              "type": "string",
              "nullable": false,
              "example": "2024-11-28T09:44:55.000Z"
            }
          },
          "required": [
            "tokenAddress",
            "name",
            "symbol",
            "logo",
            "decimals",
            "priceNative",
            "priceUsd",
            "liquidity",
            "fullyDilutedValuation",
            "graduatedAt"
          ]
        },
        "HolderTimelineItemDto": {
          "type": "object",
          "properties": {
            "timestamp": {
              "type": "string",
              "example": "2025-02-25T00:00:00Z"
            },
            "totalHolders": {
              "type": "number",
              "example": 2000
            },
            "netHolderChange": {
              "type": "number",
              "example": 50
            },
            "holderPercentChange": {
              "type": "number",
              "example": 2.5
            },
            "newHoldersByAcquisition": {
              "$ref": "#/components/schemas/NewHoldersByAcquisitionDTO"
            },
            "holdersIn": {
              "$ref": "#/components/schemas/HolderCategoryDTO"
            },
            "holdersOut": {
              "$ref": "#/components/schemas/HolderCategoryDTO"
            }
          },
          "required": [
            "timestamp",
            "totalHolders",
            "netHolderChange",
            "holderPercentChange",
            "newHoldersByAcquisition",
            "holdersIn",
            "holdersOut"
          ]
        },
        "HoldersByAcquisitionDto": {
          "type": "object",
          "properties": {
            "swap": {
              "type": "number",
              "example": 150
            },
            "transfer": {
              "type": "number",
              "example": 50
            },
            "airdrop": {
              "type": "number",
              "example": 20
            }
          },
          "required": [
            "swap",
            "transfer",
            "airdrop"
          ]
        },
        "HolderChangeSummaryDTO": {
          "type": "object",
          "properties": {
            "5min": {
              "$ref": "#/components/schemas/HolderChangeDto"
            },
            "1h": {
              "$ref": "#/components/schemas/HolderChangeDto"
            },
            "6h": {
              "$ref": "#/components/schemas/HolderChangeDto"
            },
            "24h": {
              "$ref": "#/components/schemas/HolderChangeDto"
            },
            "3d": {
              "$ref": "#/components/schemas/HolderChangeDto"
            },
            "7d": {
              "$ref": "#/components/schemas/HolderChangeDto"
            },
            "30d": {
              "$ref": "#/components/schemas/HolderChangeDto"
            }
          },
          "required": [
            "5min",
            "1h",
            "6h",
            "24h",
            "3d",
            "7d",
            "30d"
          ]
        },
        "HolderDistributionDto": {
          "type": "object",
          "properties": {
            "whales": {
              "type": "number",
              "example": 150
            },
            "sharks": {
              "type": "number",
              "example": 150
            },
            "dolphins": {
              "type": "number",
              "example": 150
            },
            "fish": {
              "type": "number",
              "example": 150
            },
            "octopus": {
              "type": "number",
              "example": 150
            },
            "crabs": {
              "type": "number",
              "example": 150
            },
            "shrimps": {
              "type": "number",
              "example": 150
            }
          },
          "required": [
            "whales",
            "sharks",
            "dolphins",
            "fish",
            "octopus",
            "crabs",
            "shrimps"
          ]
        },
        "HolderSupplyDto": {
          "type": "object",
          "properties": {
            "top10": {
              "$ref": "#/components/schemas/HolderSupplyChangeDto"
            },
            "top25": {
              "$ref": "#/components/schemas/HolderSupplyChangeDto"
            },
            "top50": {
              "$ref": "#/components/schemas/HolderSupplyChangeDto"
            },
            "top100": {
              "$ref": "#/components/schemas/HolderSupplyChangeDto"
            },
            "top250": {
              "$ref": "#/components/schemas/HolderSupplyChangeDto"
            },
            "top500": {
              "$ref": "#/components/schemas/HolderSupplyChangeDto"
            }
          },
          "required": [
            "top10",
            "top25",
            "top50",
            "top100",
            "top250",
            "top500"
          ]
        },
        "TopHolderResultDto": {
          "type": "object",
          "properties": {
            "balance": {
              "type": "string"
            },
            "balanceFormatted": {
              "type": "string"
            },
            "isContract": {
              "type": "boolean"
            },
            "ownerAddress": {
              "type": "string"
            },
            "usdValue": {
              "type": "string",
              "nullable": true,
              "default": null
            },
            "percentageRelativeToTotalSupply": {
              "type": "number"
            }
          },
          "required": [
            "balance",
            "balanceFormatted",
            "isContract",
            "ownerAddress",
            "usdValue",
            "percentageRelativeToTotalSupply"
          ]
        },
        "MediaCollection": {
          "type": "object",
          "properties": {
            "low": {
              "$ref": "#/components/schemas/MediaItem"
            },
            "medium": {
              "$ref": "#/components/schemas/MediaItem"
            },
            "high": {
              "$ref": "#/components/schemas/MediaItem"
            }
          }
        },
        "SniperTransaction": {
          "type": "object",
          "properties": {
            "transactionHash": {
              "type": "string"
            },
            "transactionTimestamp": {
              "type": "string"
            },
            "blocksAfterCreation": {
              "type": "number"
            }
          },
          "required": [
            "transactionHash",
            "transactionTimestamp",
            "blocksAfterCreation"
          ]
        },
        "SwapTokenMetadataDto": {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "nullable": true,
              "example": "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f"
            },
            "name": {
              "type": "string",
              "nullable": true,
              "example": "Wrapped Ether"
            },
            "symbol": {
              "type": "string",
              "nullable": true,
              "example": "WETH"
            },
            "logo": {
              "type": "string",
              "nullable": true,
              "example": "https://logo.moralis.io/0xe708_0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f_769a0b766bd3d6d1830f0a95d7b3e313"
            },
            "amount": {
              "type": "string",
              "nullable": true,
              "example": "0.000014332429005002"
            },
            "usdPrice": {
              "type": "number",
              "nullable": true,
              "example": 3148.1828278180296
            },
            "usdAmount": {
              "type": "number",
              "nullable": true,
              "example": 0.0123
            },
            "tokenType": {
              "type": "string",
              "nullable": true,
              "example": "token1"
            }
          },
          "required": [
            "address",
            "name",
            "symbol",
            "logo",
            "amount",
            "usdPrice",
            "usdAmount",
            "tokenType"
          ]
        },
        "PairInfo": {
          "type": "object",
          "properties": {
            "tokenAddress": {
              "type": "string"
            },
            "tokenName": {
              "type": "string",
              "nullable": true
            },
            "tokenSymbol": {
              "type": "string",
              "nullable": true
            },
            "tokenLogo": {
              "type": "string",
              "nullable": true
            },
            "tokenDecimals": {
              "type": "string",
              "nullable": true
            },
            "pairTokenType": {
              "type": "string"
            },
            "liquidityUsd": {
              "type": "number",
              "nullable": true
            }
          },
          "required": [
            "tokenAddress",
            "tokenName",
            "tokenSymbol",
            "tokenLogo",
            "tokenDecimals",
            "pairTokenType",
            "liquidityUsd"
          ]
        },
        "NewHoldersByAcquisitionDTO": {
          "type": "object",
          "properties": {
            "swap": {
              "type": "number",
              "example": 150
            },
            "transfer": {
              "type": "number",
              "example": 50
            },
            "airdrop": {
              "type": "number",
              "example": 20
            }
          },
          "required": [
            "swap",
            "transfer",
            "airdrop"
          ]
        },
        "HolderCategoryDTO": {
          "type": "object",
          "properties": {
            "whales": {
              "type": "number",
              "example": 5
            },
            "sharks": {
              "type": "number",
              "example": 12
            },
            "dolphins": {
              "type": "number",
              "example": 20
            },
            "fish": {
              "type": "number",
              "example": 100
            },
            "octopus": {
              "type": "number",
              "example": 50
            },
            "crabs": {
              "type": "number",
              "example": 200
            },
            "shrimps": {
              "type": "number",
              "example": 1000
            }
          },
          "required": [
            "whales",
            "sharks",
            "dolphins",
            "fish",
            "octopus",
            "crabs",
            "shrimps"
          ]
        },
        "HolderChangeDto": {
          "type": "object",
          "properties": {
            "change": {
              "type": "number",
              "example": 50
            },
            "changePercent": {
              "type": "number",
              "example": 2.5
            }
          },
          "required": [
            "change",
            "changePercent"
          ]
        },
        "HolderSupplyChangeDto": {
          "type": "object",
          "properties": {
            "supply": {
              "type": "string",
              "example": "1000000.123456"
            },
            "supplyPercent": {
              "type": "number",
              "example": 12.5
            }
          },
          "required": [
            "supply",
            "supplyPercent"
          ]
        },
        "MediaItem": {
          "type": "object",
          "properties": {
            "width": {
              "type": "number"
            },
            "height": {
              "type": "number"
            },
            "url": {
              "type": "string"
            }
          }
        }
      }
    }
  },
  "customOptions": {
    "persistAuthorization": true
  }
};
`;