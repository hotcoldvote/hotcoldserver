const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Path to JSON file that stores Elo data
const pathToJSON = path.join(__dirname, 'elo.json');

// Load Elo array from file or initialize default
let sharedArray;

try {
  const fileData = fs.readFileSync(pathToJSON, 'utf8');
  sharedArray = JSON.parse(fileData);
  console.log('Loaded Elo data from elo.json');
} catch (err) {
  console.warn('Could not load elo.json. Using default array.');
  sharedArray = [
    [1, 1000], [2, 1000], [3, 1000],
    [4, 1000], [5, 1000], [6, 1000],
    [7, 1000], [8, 1000], [9, 1000]
  ];
  fs.writeFileSync(pathToJSON, JSON.stringify(sharedArray, null, 2));
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Function to back up sharedArray to GitHub as elobackup.json
async function saveBackupToGitHub(arrayData) {
  const token = process.env.GITHUB_TOKEN;
  const owner = 'hotcoldvote';         // <-- CHANGE THIS
  const repo = 'hotcoldserver';                // <-- CHANGE THIS
  const path = 'elo.json';                // <-- GitHub file name

  try {
    // Get current SHA to update the file
    const { data: current } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    // Update file with new content
    await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        message: 'Update elobackup.json from Render server',
        content: Buffer.from(JSON.stringify(arrayData, null, 2)).toString('base64'),
        sha: current.sha
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('Backup saved to GitHub successfully.');
  } catch (err) {
    console.error('Failed to back up to GitHub:', err.response?.data || err.message);
  }
}

// WebSocket connection handling
wss.on('connection', ws => {
  // Send current Elo array on connection
  ws.send(JSON.stringify({ type: 'array_update', data: sharedArray }));

  ws.on('message', message => {
    const parsed = JSON.parse(message);

    if (parsed.type === 'request_array') {
      ws.send(JSON.stringify({ type: 'array_update', data: sharedArray }));
    }

    if (parsed.type === 'update_array') {
      sharedArray = parsed.data;

      // Save to local file
      fs.writeFileSync(pathToJSON, JSON.stringify(sharedArray, null, 2));

      // Save to GitHub
      saveBackupToGitHub(sharedArray);

      // Broadcast to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'array_update', data: sharedArray }));
        }
      });
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
