const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

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
  // Save default array to file
  fs.writeFileSync(pathToJSON, JSON.stringify(sharedArray, null, 2));
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handling
wss.on('connection', ws => {
  // Send current Elo array on connection
  ws.send(JSON.stringify({ type: 'array_update', data: sharedArray }));

  ws.on('message', message => {
    const parsed = JSON.parse(message);

    // Client requests Elo array
    if (parsed.type === 'request_array') {
      ws.send(JSON.stringify({ type: 'array_update', data: sharedArray }));
    }

    // Client sends updated Elo array
    if (parsed.type === 'update_array') {
      sharedArray = parsed.data;

      // Save updated Elo array to JSON file
      fs.writeFileSync(pathToJSON, JSON.stringify(sharedArray, null, 2));

      // Broadcast to all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'array_update', data: sharedArray }));
        }
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
