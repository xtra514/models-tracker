import fetch from 'node-fetch';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/NVIDIA_API_KEY=(.*)/);
process.env.NVIDIA_API_KEY = match ? match[1].trim() : '';

async function test() {
  const API_KEY = process.env.NVIDIA_API_KEY;
  if (!API_KEY) {
    console.error("No API Key");
    return;
  }
  
  const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  
  const data = await res.json();
  if (data.data && data.data.length > 0) {
    console.log(JSON.stringify(data.data[0], null, 2));
  } else {
    console.log("No models found or error:", data);
  }
}
test();
