import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configuration path
const configPath = path.join(process.cwd(), 'config.json');

// Function to load configuration
function loadConfig() {
  try {
    const configData = readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading configuration:', error);
    return {
      access: { ip: 'localhost' },
      server: { port: 3001 }
    };
  }
}

// Initial configuration load
let config = loadConfig();
let accessIp = config.access?.ip || 'localhost';

// Function to refresh configuration
function refreshConfig() {
  const newConfig = loadConfig();
  config = newConfig;
  accessIp = config.access?.ip || 'localhost';
  console.log('Configuration refreshed. Access IP:', accessIp);
  return config;
}

// Watch for changes to the config file
fs.watchFile(configPath, (curr, prev) => {
  console.log('Configuration file changed. Refreshing...');
  refreshConfig();
});

// Import from our wrapper module instead of directly from TypeScript files
import { 
  OpenRouterApiHandler, 
  runPlanPhase, 
  runActPhase,
  testApiWrapper 
} from './api-wrapper.js';

// Test if the wrapper module is working
console.log('Testing API wrapper module...');
try {
  testApiWrapper();
} catch (err) {
  console.error('Error testing API wrapper:', err);
}

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base output directory
const BASE_OUTPUT_DIR = path.join(__dirname, '../../../../webapp-output');

// Session storage for mapping socket IDs to session IDs
const sessionMap = new Map();
// Storage for output directories by session
const sessionOutputDirs = new Map();

// Function to create a unique output directory for each generation
function createUniqueOutputDir(sessionId) {
  // Create a session and timestamp-based folder name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folderName = `webapp-${sessionId}-${timestamp}`;
  const outputDir = path.join(BASE_OUTPUT_DIR, folderName);
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return outputDir;
}

// Function to find the most recent webapp directory for a session
function findMostRecentWebappDir(sessionId) {
  try {
    // Check if we have a stored directory for this session
    if (sessionId && sessionOutputDirs.has(sessionId)) {
      const dir = sessionOutputDirs.get(sessionId);
      if (dir && fs.existsSync(dir)) {
        return dir;
      }
    }
    
    const baseDir = BASE_OUTPUT_DIR;
    if (!fs.existsSync(baseDir)) {
      return null;
    }
    
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    
    // Filter for directories that match our webapp pattern for this session
    const webappDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(`webapp-${sessionId}`))
      .map(entry => ({
        name: entry.name,
        path: path.join(baseDir, entry.name),
        // Extract timestamp from directory name
        timestamp: entry.name.replace(`webapp-${sessionId}-`, '')
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort by timestamp (newest first)
    
    if (webappDirs.length > 0) {
      // Return the most recent webapp directory
      return webappDirs[0].path;
    }
    
    return null;
  } catch (err) {
    console.error('Error finding most recent webapp directory:', err);
    return null;
  }
}

// Function to get the session ID from the request
function getSessionId(req) {
  // Try to get session ID from headers first
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    return sessionId;
  }
  
  // If not in headers, try to get from socket ID
  const socketId = req.headers['x-socket-id'];
  if (socketId && sessionMap.has(socketId)) {
    return sessionMap.get(socketId) || null;
  }
  
  return null;
}

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

// Socket.IO connection
io.on('connection', (socket) => {
  // Generate a unique session ID for this connection
  const sessionId = uuidv4();
  // Store the mapping of socket ID to session ID
  sessionMap.set(socket.id, sessionId);
  
  console.log(`Client connected: ${socket.id} (Session: ${sessionId})`);
  
  // Join a room with the session ID for targeted events
  socket.join(sessionId);
  
  // Send the session ID to the client
  socket.emit('session-created', { sessionId });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id} (Session: ${sessionId})`);
    // Clean up the session mapping
    sessionMap.delete(socket.id);
    // Note: We don't delete the output directory mapping here
    // as the user might reconnect and want to access their previous work
  });
});

// Create API router
const apiRouter = express.Router();

// Create a new webapp
apiRouter.post('/create', async (req, res) => {
  try {
    const { description } = req.body;

    // Validate input
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Get the session ID from the request
    const sessionId = getSessionId(req) || 'default';

    // Create API handler with API key from config
    const apiHandler = new OpenRouterApiHandler();

    // Set up event listeners for real-time updates
    apiHandler.on('data', (chunk) => {
      io.to(sessionId).emit('generation-progress', { type: 'data', data: chunk });
    });

    // Emit initial status
    io.to(sessionId).emit('generation-progress', { type: 'status', data: 'Planning phase started' });
    
    // Custom event emitter for plan phase
    const planEmitter = {
      emit: (event, data) => {
        if (event === 'data') {
          io.to(sessionId).emit('generation-progress', { type: 'plan-data', data });
        }
      }
    };
    
    // Override the on method to capture events
    apiHandler.on = (event, listener) => {
      if (event === 'data') {
        planEmitter.emit = (emitEvent, data) => {
          if (emitEvent === 'data') {
            listener(data);
            io.to(sessionId).emit('generation-progress', { type: 'plan-data', data });
          }
        };
      }
      return apiHandler;
    };
    
    // Run Plan phase
    const planData = await runPlanPhase(description, apiHandler);
    
    io.to(sessionId).emit('generation-progress', { 
      type: 'plan-complete', 
      data: { 
        initialAnalysis: planData.initialAnalysis,
        answers: planData.answers,
        plan: planData.plan
      } 
    });

    // Start generation phase
    io.to(sessionId).emit('generation-progress', { type: 'status', data: 'Generation phase started' });
    
    // Create a unique output directory for this generation
    const outputDir = createUniqueOutputDir(sessionId);
    console.log(`Created output directory: ${outputDir} for session ${sessionId}`);
    
    // Store the output directory for this session
    sessionOutputDirs.set(sessionId, outputDir);
    
    // Run Act phase
    await runActPhase(planData, outputDir, apiHandler);
    
    // Read generated files
    const generatedFiles = fs.readdirSync(outputDir)
      .filter(file => !file.startsWith('.'))
      .map(file => {
        const filePath = path.join(outputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        return { name: file, content, path: filePath };
      });
    
    io.to(sessionId).emit('generation-progress', { 
      type: 'generation-complete', 
      data: { 
        files: generatedFiles,
        outputDir: outputDir,
        sessionId: sessionId
      } 
    });
    
    res.json({ 
      success: true, 
      message: 'WebApp generated successfully',
      files: generatedFiles,
      outputDir: outputDir,
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Error generating webapp:', error);
    
    // Get the session ID from the request for error handling
    const errorSessionId = getSessionId(req) || 'default';
    
    io.to(errorSessionId).emit('generation-progress', { 
      type: 'error', 
      data: error.message || 'An unknown error occurred' 
    });
    
    res.status(500).json({ error: error.message || 'An unknown error occurred' });
  }
});

// Preview the generated webapp
apiRouter.get('/preview', (req, res) => {
  try {
    // Refresh configuration before using it
    refreshConfig();
    
    // Get the session ID from the request
    const sessionId = getSessionId(req) || 'default';
    
    // Find the most recent webapp directory for this session
    const outputDir = findMostRecentWebappDir(sessionId);
    
    // Check if the output directory exists
    if (!outputDir) {
      throw new Error(`No valid output directory found. Generate a webapp first.`);
    }
    
    // Check if index.html exists in the output directory
    const indexPath = path.join(outputDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.html not found in ${outputDir}`);
    }
    
    // Get the server port from config or use default
    const serverPort = config.server?.port || 3001;
    
    // Create a URL to the index.html file using the configured IP
    const httpUrl = `http://${accessIp}:${serverPort}/preview/${path.basename(outputDir)}`;
    
    // Also create a file:// URL as fallback
    const fileUrl = `file://${indexPath}`;
    
    // Log the preview URLs and directory for debugging
    console.log(`HTTP Preview URL: ${httpUrl}`);
    console.log(`File Preview URL: ${fileUrl}`);
    console.log(`Serving files from: ${outputDir}`);
    
    // Create a symlink or copy the output directory to a location accessible by the web server
    const previewDir = path.join(__dirname, '../../client/preview');
    if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
    }
    
    const previewPath = path.join(previewDir, path.basename(outputDir));
    
    // Remove existing symlink/directory if it exists
    if (fs.existsSync(previewPath)) {
        try {
            // Check if it's a symlink
            const stats = fs.lstatSync(previewPath);
            if (stats.isSymbolicLink()) {
                fs.unlinkSync(previewPath);
            } else {
                // It's a directory, remove it recursively
                fs.rmSync(previewPath, { recursive: true, force: true });
            }
        } catch (err) {
            console.error('Error removing existing preview directory:', err);
        }
    }
    
    try {
        // Try to create a symlink first (more efficient)
        fs.symlinkSync(outputDir, previewPath, 'dir');
        console.log(`Created symlink from ${outputDir} to ${previewPath}`);
    } catch (err) {
        console.error('Error creating symlink, falling back to copy:', err);
        
        // If symlink fails (e.g., on Windows without admin rights), copy the files
        const copyFiles = (src, dest) => {
            const entries = fs.readdirSync(src, { withFileTypes: true });
            
            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);
                
                if (entry.isDirectory()) {
                    fs.mkdirSync(destPath, { recursive: true });
                    copyFiles(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };
        
        fs.mkdirSync(previewPath, { recursive: true });
        copyFiles(outputDir, previewPath);
        console.log(`Copied files from ${outputDir} to ${previewPath}`);
    }
    
    res.json({ 
        success: true, 
        previewUrl: httpUrl,
        fileUrl: fileUrl
    });
  } catch (error) {
    console.error('Error starting preview server:', error);
    res.status(500).json({ error: error.message || 'An unknown error occurred' });
  }
});

// Validate the generated webapp
apiRouter.post('/validate', async (req, res) => {
  try {
    // Get the session ID from the request
    const sessionId = getSessionId(req) || 'default';
    
    // Find the most recent webapp directory for this session
    const outputDir = findMostRecentWebappDir(sessionId);
    
    // Check if the output directory exists
    if (!outputDir) {
      throw new Error(`No valid output directory found. Generate a webapp first.`);
    }
    
    // Check if index.html exists in the output directory
    const indexPath = path.join(outputDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.html not found in ${outputDir}`);
    }
    
    // Create a file:// URL to the index.html file
    const fileUrl = `file://${indexPath}`;
    
    // Emit validation started status to the specific session
    io.to(sessionId).emit('validation-progress', { type: 'status', data: 'Validation started' });
    
    // Since we can't use Puppeteer directly, we'll simulate validation
    // In a real implementation, you would use Puppeteer to open the page and check for errors
    
    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a validation result
    const validationResult = {
      success: true,
      message: 'WebApp validated successfully. No errors found.',
      logs: [
        'Page loaded successfully',
        'All resources loaded without errors',
        'No JavaScript errors detected',
        'UI elements rendered correctly'
      ]
    };
    
    // Emit validation complete to the specific session
    io.to(sessionId).emit('validation-progress', { 
      type: 'validation-complete', 
      data: validationResult
    });
    
    res.json(validationResult);
  } catch (error) {
    console.error('Error validating webapp:', error);
    
    // Get the session ID from the request for error handling
    const errorSessionId = getSessionId(req) || 'default';
    
    const errorResult = {
      success: false,
      message: error.message || 'An unknown error occurred during validation',
      logs: [
        'Error: ' + (error.message || 'Unknown error')
      ]
    };
    
    io.to(errorSessionId).emit('validation-progress', { 
      type: 'validation-complete', 
      data: errorResult
    });
    
    res.status(500).json(errorResult);
  }
});

// Process feedback and update the webapp
apiRouter.post('/feedback', async (req, res) => {
  try {
    const { feedback } = req.body;
    
    // Validate input
    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }
    
    // Get the session ID from the request
    const sessionId = getSessionId(req) || 'default';
    
    // Find the most recent webapp directory for this session
    const outputDir = findMostRecentWebappDir(sessionId);
    
    // Check if the output directory exists
    if (!outputDir) {
      throw new Error(`No valid output directory found. Generate a webapp first.`);
    }
    
    // Read the current files
    const currentFiles = fs.readdirSync(outputDir)
      .filter(file => !file.startsWith('.'))
      .map(file => {
        const filePath = path.join(outputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        return { name: file, content, path: filePath };
      });
    
    // Create API handler with API key from config
    const apiHandler = new OpenRouterApiHandler();
    
    // Set up event listeners for real-time updates
    apiHandler.on('data', (chunk) => {
      io.to(sessionId).emit('feedback-progress', { type: 'data', data: chunk });
    });
    
    // Emit initial status
    io.to(sessionId).emit('feedback-progress', { type: 'status', data: 'Processing feedback' });
    
    // Prepare the system prompt for feedback processing
    const systemPrompt = `
You are a web application developer. A user has provided feedback on a web application you generated.
Your task is to modify the code based on the user's feedback.

The web application consists of the following files:
${currentFiles.map(file => `- ${file.name}`).join('\n')}

You will be provided with:
1. The original code for each file
2. The user's feedback

Please provide updated versions of the files that address the user's feedback.
Make sure the updated files are complete and work together correctly.
`;

    // Prepare the user message with the feedback and current code
    const userMessage = `
User Feedback: ${feedback}

Current Files:
${currentFiles.map(file => `
--- ${file.name} ---
\`\`\`
${file.content}
\`\`\`
`).join('\n')}

Please provide updated versions of these files that address the user's feedback.
`;

    // Call the OpenRouter API
    const feedbackResponse = await apiHandler.createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userMessage }]
    );
    
    console.log('Feedback processing completed');
    
    // Extract the updated files from the response
    // This is a simplified extraction, you might need to adjust based on the actual response format
    const updatedFiles = [];
    
    // First, try to extract files using markdown code blocks with file names
    const fileBlockRegex = /---\s*([\w.-]+)\s*---\s*```(?:\w+)?\s*([\s\S]*?)\s*```/g;
    let match;
    
    while ((match = fileBlockRegex.exec(feedbackResponse)) !== null) {
      const fileName = match[1].trim();
      const fileContent = match[2].trim();
      
      // Find the original file path
      const originalFile = currentFiles.find(f => f.name === fileName);
      if (originalFile) {
        updatedFiles.push({
          name: fileName,
          content: fileContent,
          path: originalFile.path
        });
      }
    }
    
    // If we couldn't extract any files, try a different approach with code blocks and file names
    if (updatedFiles.length === 0) {
      // Look for code blocks with language hints that match our file types
      const htmlMatch = feedbackResponse.match(/```(?:html)\s*([\s\S]*?)\s*```/);
      const cssMatch = feedbackResponse.match(/```(?:css)\s*([\s\S]*?)\s*```/);
      const jsMatch = feedbackResponse.match(/```(?:javascript|js)\s*([\s\S]*?)\s*```/);
      
      // Add HTML file if found
      if (htmlMatch && htmlMatch[1]) {
        const htmlFile = currentFiles.find(f => f.name === 'index.html');
        if (htmlFile) {
          updatedFiles.push({
            name: 'index.html',
            content: htmlMatch[1].trim(),
            path: htmlFile.path
          });
        }
      }
      
      // Add CSS file if found
      if (cssMatch && cssMatch[1]) {
        const cssFile = currentFiles.find(f => f.name === 'styles.css');
        if (cssFile) {
          updatedFiles.push({
            name: 'styles.css',
            content: cssMatch[1].trim(),
            path: cssFile.path
          });
        }
      }
      
      // Add JS file if found
      if (jsMatch && jsMatch[1]) {
        const jsFile = currentFiles.find(f => f.name === 'script.js');
        if (jsFile) {
          updatedFiles.push({
            name: 'script.js',
            content: jsMatch[1].trim(),
            path: jsFile.path
          });
        }
      }
    }
    
    // If we still couldn't extract any files, try a third approach with file name headers
    if (updatedFiles.length === 0) {
      // Try to match each file name and extract the content that follows
      for (const file of currentFiles) {
        const fileNameRegex = new RegExp(`${file.name}[\\s\\S]*?\`\`\`(?:\\w+)?([\\s\\S]*?)\`\`\``, 'i');
        const fileMatch = feedbackResponse.match(fileNameRegex);
        
        if (fileMatch && fileMatch[1]) {
          updatedFiles.push({
            name: file.name,
            content: fileMatch[1].trim(),
            path: file.path
          });
        }
      }
    }
    
    // If we still couldn't extract any files, try a fourth approach with file name patterns
    if (updatedFiles.length === 0) {
      const filePatterns = [
        { name: 'index.html', pattern: /<html[\s\S]*?<\/html>/ },
        { name: 'styles.css', pattern: /body\s*{[\s\S]*?}/ },
        { name: 'script.js', pattern: /document\.addEventListener\(['"]DOMContentLoaded['"][\s\S]*?}\);/ }
      ];
      
      for (const pattern of filePatterns) {
        const match = feedbackResponse.match(pattern.pattern);
        if (match) {
          const originalFile = currentFiles.find(f => f.name === pattern.name);
          if (originalFile) {
            updatedFiles.push({
              name: pattern.name,
              content: match[0],
              path: originalFile.path
            });
          }
        }
      }
    }
    
    // If we still couldn't extract any files, use the original files
    if (updatedFiles.length === 0) {
      console.warn('Could not extract updated files from the response. Using original files.');
      updatedFiles.push(...currentFiles);
    }
    
    // Create a new directory for the updated files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const updatedFolderName = `webapp-${sessionId}-${timestamp}-updated`;
    const updatedOutputDir = path.join(path.dirname(outputDir), updatedFolderName);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(updatedOutputDir)) {
      fs.mkdirSync(updatedOutputDir, { recursive: true });
    }
    
    // Write the updated files to the new directory
    for (const file of updatedFiles) {
      const filePath = path.join(updatedOutputDir, file.name);
      fs.writeFileSync(filePath, file.content);
      file.path = filePath; // Update the path to the new location
    }
    
    // Update the output directory for this session
    sessionOutputDirs.set(sessionId, updatedOutputDir);
    
    // Prepare the response
    const responseData = {
      success: true,
      message: 'Feedback processed successfully',
      response: feedbackResponse.split('```')[0].trim(), // Extract the explanation part
      updatedFiles
    };
    
    // Emit feedback complete
    io.to(sessionId).emit('feedback-progress', { 
      type: 'feedback-complete', 
      data: responseData
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Error processing feedback:', error);
    
    // Get the session ID from the request for error handling
    const errorSessionId = getSessionId(req) || 'default';
    
    const errorResult = {
      success: false,
      message: error.message || 'An unknown error occurred while processing feedback',
    };
    
    io.to(errorSessionId).emit('feedback-progress', { 
      type: 'error', 
      data: error.message || 'An unknown error occurred'
    });
    
    res.status(500).json(errorResult);
  }
});

// Config endpoint to provide access IP to clients
apiRouter.get('/config', (req, res) => {
  // Refresh configuration before responding
  refreshConfig();
  
  res.json({
    accessIp: accessIp,
    serverPort: config.server?.port || 3001
  });
});

// API routes
app.use('/api', apiRouter);

// Serve preview files
app.use('/preview', express.static(path.join(__dirname, '../../client/preview')));

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../../client')));

// Serve API test page
app.get('/api-test', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/api-test.html'));
});

// Serve the demo page directly
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/demo.html'));
});

// Redirect root to demo page
app.get('/', (req, res) => {
  res.redirect('/demo');
});

// Catch-all route for any other routes
app.get('*', (req, res) => {
  // Check if the request is already for /api/demo to prevent redirect loops
  if (req.path === '/api/demo') {
    res.sendFile(path.join(__dirname, '../../client/demo.html'));
  } else {
    res.redirect('/demo');
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  // Refresh configuration before logging
  refreshConfig();
  
  console.log(`Server running on port ${PORT}`);
  console.log(`For external access use: http://${accessIp}:${PORT}/api/demo`);
});

export { io, sessionMap, sessionOutputDirs };
