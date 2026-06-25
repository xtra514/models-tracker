import { motion } from 'framer-motion';

export function ApiDocsTab() {
  const host = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';

  const codeSnippets = {
    curl: `curl -X GET "${host}/api/v1/models" \\
  -H "Content-Type: application/json"`,
    js: `fetch("${host}/api/v1/models")
  .then(res => res.json())
  .then(data => console.log(data));`,
    python: `import requests

response = requests.get("${host}/api/v1/models")
print(response.json())`
  };

  return (
    <motion.div 
      className="api-docs-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="docs-header">
        <h2>Developer API</h2>
        <p>Integrate real-time NVIDIA model status and latency data into your own applications.</p>
        <div className="api-badge">No Authentication Required</div>
      </div>

      <div className="docs-grid">
        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method get">GET</span>
            <code className="url">/api/v1/models</code>
          </div>
          <p className="endpoint-desc">Returns the full list of tracked models including real-time status (online/offline/degraded), latency, and uptime percentage.</p>
          
          <div className="code-example">
            <div className="code-tabs">
              <span className="active">cURL</span>
            </div>
            <pre><code>{codeSnippets.curl}</code></pre>
          </div>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method get">GET</span>
            <code className="url">/api/v1/models/:owner/:id</code>
          </div>
          <p className="endpoint-desc">Get the status of a specific model by providing its owner and ID (e.g. <code>meta/llama-3.1-8b-instruct</code>).</p>
        </div>

        <div className="endpoint-card">
          <div className="endpoint-header">
            <span className="method get">GET</span>
            <code className="url">/api/v1/stats</code>
          </div>
          <p className="endpoint-desc">Returns aggregate network health statistics such as total models online and average network latency.</p>
        </div>
      </div>
    </motion.div>
  );
}
