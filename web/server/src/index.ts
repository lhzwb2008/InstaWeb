import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './routes/api.js';
import { getServerPort, getConfig } from '../../../src/utils/config.js';
import { v4 as uuidv4 } from 'uuid';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Session storage for mapping socket IDs to session IDs
export const sessionMap = new Map<string, string>();
// Storage for output directories by session
export const sessionOutputDirs = new Map<string, string>();

// Socket.IO connection
io.on('connection', (socket) => {
  // Generate a unique session ID for this connection
  const sessionId = uuidv4();
  // Store the mapping of socket ID to session ID
  sessionMap.set(socket.id, sessionId);
  
  // Join a room with the session ID for targeted events
  socket.join(sessionId);
  
  // Send the session ID to the client
  socket.emit('session-created', { sessionId });
  
  socket.on('disconnect', () => {
    // Clean up the session mapping
    sessionMap.delete(socket.id);
  });
});

// API routes
app.use('/api', createApiRouter(io));

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../../client')));

// Serve preview files
app.use('/preview', express.static(path.join(__dirname, '../../client/preview')));

// Serve API test page
app.get('/api-test', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/api-test.html'));
});

// Redirect root to demo page
app.get('/', (req, res) => {
  res.redirect('/api/demo');
});

// Start the server
const PORT = getServerPort();
const config = getConfig();
const accessIp = config.access?.ip || 'localhost';

server.listen(PORT, '0.0.0.0', () => {
  console.log(`InstaWeb server running on port ${PORT}`);
  console.log(`Demo page available at: http://${accessIp}:${PORT}/api/demo`);
  console.log(`API test page available at: http://${accessIp}:${PORT}/api-test`);
  console.log(`For external access use: http://${accessIp}:${PORT}`);
  
  // Preview server info
  const previewPort = config.preview.port;
  console.log(`Preview server will be available at: http://${accessIp}:${previewPort}`);
});

export { io };
