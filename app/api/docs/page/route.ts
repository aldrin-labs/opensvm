import { NextResponse } from 'next/server';
import { API_DOCUMENTATION, API_CATEGORIES, generateCurlCommand } from '@/lib/api/api-documentation';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET() {
  // Generate HTML documentation page
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenSVM API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2563eb;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      font-size: 18px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-number {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      color: #666;
      margin-top: 5px;
    }
    .search-box {
      width: 100%;
      padding: 12px 20px;
      font-size: 16px;
      border: 2px solid #ddd;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .category-section {
      background: white;
      margin-bottom: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .category-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .category-header h2 {
      margin: 0;
    }
    .endpoint-count {
      background: rgba(255,255,255,0.2);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 14px;
    }
    .endpoints {
      padding: 20px;
    }
    .endpoint {
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      margin-bottom: 15px;
      overflow: hidden;
    }
    .endpoint-header {
      padding: 15px 20px;
      background: #fafafa;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .method {
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
      text-transform: uppercase;
    }
    .method-get { background: #10b981; color: white; }
    .method-post { background: #3b82f6; color: white; }
    .method-put { background: #f59e0b; color: white; }
    .method-delete { background: #ef4444; color: white; }
    .path {
      font-family: 'Courier New', monospace;
      color: #4b5563;
      flex: 1;
    }
    .endpoint-details {
      padding: 20px;
      border-top: 1px solid #e5e5e5;
      display: none;
    }
    .endpoint.expanded .endpoint-details {
      display: block;
    }
    .description {
      color: #666;
      margin-bottom: 20px;
    }
    .parameters {
      margin-bottom: 20px;
    }
    .parameter {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .param-name {
      font-weight: bold;
      color: #2563eb;
    }
    .param-type {
      background: #e5e5e5;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      margin-left: 10px;
    }
    .required {
      color: #ef4444;
      font-size: 12px;
      margin-left: 5px;
    }
    .code-block {
      background: #1e293b;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin: 10px 0;
    }
    .response-status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
      margin-right: 10px;
    }
    .status-200 { background: #10b981; color: white; }
    .status-400 { background: #f59e0b; color: white; }
    .status-404 { background: #6b7280; color: white; }
    .status-500 { background: #ef4444; color: white; }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      border-bottom: 2px solid #e5e5e5;
    }
    .tab {
      padding: 8px 16px;
      background: none;
      border: none;
      cursor: pointer;
      color: #666;
      font-size: 14px;
    }
    .tab.active {
      color: #2563eb;
      border-bottom: 2px solid #2563eb;
      margin-bottom: -2px;
    }
    .info-box {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 12px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .rate-limit {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
    }
    .auth-required {
      background: #fee2e2;
      border-left: 4px solid #ef4444;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 OpenSVM API Documentation</h1>
      <p class="subtitle">Comprehensive Solana blockchain API with ${API_DOCUMENTATION.length}+ endpoints</p>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-number">${API_DOCUMENTATION.length}</div>
        <div class="stat-label">Total Endpoints</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Object.keys(API_CATEGORIES).length}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">60</div>
        <div class="stat-label">Req/Min Rate Limit</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">v1.0</div>
        <div class="stat-label">API Version</div>
      </div>
    </div>

    <input type="text" class="search-box" id="searchBox" placeholder="Search endpoints, paths, or descriptions..." />

    <div class="info-box">
      <strong>Base URL:</strong> https://osvm.ai/api (production) | http://localhost:3000/api (development)
    </div>

    ${Object.entries(API_CATEGORIES).map(([key, category]) => {
      const endpoints = API_DOCUMENTATION.filter(e => e.category === category);
      if (endpoints.length === 0) return '';

      return `
    <div class="category-section">
      <div class="category-header" onclick="toggleCategory('${key}')">
        <h2>${category}</h2>
        <span class="endpoint-count">${endpoints.length} endpoints</span>
      </div>
      <div class="endpoints" id="category-${key}">
        ${endpoints.map((endpoint, index) => `
        <div class="endpoint" onclick="toggleEndpoint(event, '${key}-${index}')">
          <div class="endpoint-header">
            <span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
            <span class="path">${endpoint.path}</span>
          </div>
          <div class="endpoint-details" id="endpoint-${key}-${index}">
            <p class="description">${endpoint.description}</p>

            ${endpoint.authentication ? `
            <div class="info-box auth-required">
              <strong>🔐 Authentication:</strong> ${endpoint.authentication}
            </div>
            ` : ''}

            ${endpoint.rateLimit ? `
            <div class="info-box rate-limit">
              <strong>⏱️ Rate Limit:</strong> ${endpoint.rateLimit}
            </div>
            ` : ''}

            ${endpoint.parameters && endpoint.parameters.length > 0 ? `
            <div class="parameters">
              <h4>Parameters:</h4>
              ${endpoint.parameters.map(param => `
              <div class="parameter">
                <span class="param-name">${param.name}</span>
                <span class="param-type">${param.type}</span>
                ${param.required ? '<span class="required">*required</span>' : ''}
                <div>${param.description}</div>
                ${param.example ? `<div style="color:#666; font-size:12px; margin-top:5px;">Example: ${param.example}</div>` : ''}
              </div>
              `).join('')}
            </div>
            ` : ''}

            ${endpoint.requestBody ? `
            <div>
              <h4>Request Body:</h4>
              <div class="code-block">${JSON.stringify(endpoint.requestBody.example, null, 2)}</div>
            </div>
            ` : ''}

            <div>
              <h4>Responses:</h4>
              ${endpoint.responses.map(response => `
              <div style="margin-bottom: 10px;">
                <span class="response-status status-${response.status}">${response.status}</span>
                <span>${response.description}</span>
                ${response.example ? `
                <div class="code-block">${JSON.stringify(response.example, null, 2)}</div>
                ` : ''}
              </div>
              `).join('')}
            </div>

            <div class="tabs">
              <button class="tab active" onclick="showExample(event, '${key}-${index}', 'curl')">cURL</button>
              <button class="tab" onclick="showExample(event, '${key}-${index}', 'js')">JavaScript</button>
              <button class="tab" onclick="showExample(event, '${key}-${index}', 'python')">Python</button>
            </div>

            <div id="example-${key}-${index}-curl" class="example-content">
              <div class="code-block">${generateCurlCommand(endpoint).replace(/\n/g, '<br>')}</div>
            </div>

            <div id="example-${key}-${index}-js" class="example-content" style="display:none;">
              <div class="code-block">// ${endpoint.summary}
const response = await fetch('https://osvm.ai/api${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Content-Type': 'application/json'${endpoint.authentication === 'jwt' ? ",\n    'Authorization': 'Bearer ' + token" : ''}
  }${endpoint.requestBody ? `,
  body: JSON.stringify(${JSON.stringify(endpoint.requestBody.example)})` : ''}
});

const data = await response.json();</div>
            </div>

            <div id="example-${key}-${index}-python" class="example-content" style="display:none;">
              <div class="code-block"># ${endpoint.summary}
import requests

response = requests.${endpoint.method.toLowerCase()}(
    'https://osvm.ai/api${endpoint.path}'${endpoint.authentication === 'jwt' ? ",\n    headers={'Authorization': f'Bearer {token}'}" : ''}${endpoint.requestBody ? `,
    json=${JSON.stringify(endpoint.requestBody.example)}` : ''}
)

data = response.json()</div>
            </div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
      `;
    }).join('')}
  </div>

  <script>
    function toggleCategory(categoryId) {
      const element = document.getElementById('category-' + categoryId);
      element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }

    function toggleEndpoint(event, endpointId) {
      event.stopPropagation();
      const element = event.currentTarget;
      element.classList.toggle('expanded');
    }

    function showExample(event, endpointId, language) {
      event.stopPropagation();

      // Hide all examples for this endpoint
      ['curl', 'js', 'python'].forEach(lang => {
        const content = document.getElementById('example-' + endpointId + '-' + lang);
        if (content) content.style.display = 'none';
      });

      // Remove active class from all tabs
      event.target.parentElement.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });

      // Show selected example and mark tab as active
      const content = document.getElementById('example-' + endpointId + '-' + language);
      if (content) content.style.display = 'block';
      event.target.classList.add('active');
    }

    // Search functionality
    document.getElementById('searchBox').addEventListener('input', function(e) {
      const searchTerm = e.target.value.toLowerCase();
      const endpoints = document.querySelectorAll('.endpoint');

      endpoints.forEach(endpoint => {
        const text = endpoint.textContent.toLowerCase();
        endpoint.style.display = text.includes(searchTerm) ? 'block' : 'none';
      });

      // Show all categories when searching
      if (searchTerm) {
        document.querySelectorAll('.endpoints').forEach(category => {
          category.style.display = 'block';
        });
      }
    });
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}