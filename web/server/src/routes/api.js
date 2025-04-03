import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { OpenRouterApiHandler } from '../../../../src/api/openrouter.js';
import { runPlanPhase } from '../../../../src/agent/plan.js';
import { runActPhase } from '../../../../src/agent/act.js';
// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Default output directory
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '../../../../../webapp-output');
// Create API router
export function createApiRouter(io) {
    const router = express.Router();
    // Create a new webapp
    router.post('/create', async (req, res) => {
        try {
            const { description, apiKey } = req.body;
            // Validate input
            if (!description || !apiKey) {
                return res.status(400).json({ error: 'Description and API key are required' });
            }
            // Create API handler
            const apiHandler = new OpenRouterApiHandler(apiKey);
            // Set up event listeners for real-time updates
            apiHandler.on('data', (chunk) => {
                io.emit('generation-progress', { type: 'data', data: chunk });
            });
            // Run Plan phase
            io.emit('generation-progress', { type: 'status', data: 'Planning phase started' });
            // Custom event emitter for plan phase
            const planEmitter = {
                emit: (event, data) => {
                    if (event === 'data') {
                        io.emit('generation-progress', { type: 'plan-data', data });
                    }
                }
            };
            // Override the on method to capture events
            apiHandler.on = (event, listener) => {
                if (event === 'data') {
                    planEmitter.emit = (emitEvent, data) => {
                        if (emitEvent === 'data') {
                            listener(data);
                            io.emit('generation-progress', { type: 'plan-data', data });
                        }
                    };
                }
                return apiHandler;
            };
            const planData = await runPlanPhase(description, apiHandler);
            io.emit('generation-progress', {
                type: 'plan-complete',
                data: {
                    initialAnalysis: planData.initialAnalysis,
                    answers: planData.answers,
                    plan: planData.plan
                }
            });
            // Run Act phase
            io.emit('generation-progress', { type: 'status', data: 'Generation phase started' });
            // Ensure output directory exists
            if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
                fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
            }
            await runActPhase(planData, DEFAULT_OUTPUT_DIR, apiHandler);
            // Read generated files
            const generatedFiles = fs.readdirSync(DEFAULT_OUTPUT_DIR)
                .filter(file => !file.startsWith('.'))
                .map(file => {
                const filePath = path.join(DEFAULT_OUTPUT_DIR, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                return { name: file, content, path: filePath };
            });
            io.emit('generation-progress', {
                type: 'generation-complete',
                data: {
                    files: generatedFiles,
                    outputDir: DEFAULT_OUTPUT_DIR
                }
            });
            res.json({
                success: true,
                message: 'WebApp generated successfully',
                files: generatedFiles,
                outputDir: DEFAULT_OUTPUT_DIR
            });
        }
        catch (error) {
            console.error('Error generating webapp:', error);
            io.emit('generation-progress', { type: 'error', data: error.message || 'An unknown error occurred' });
            res.status(500).json({ error: error.message || 'An unknown error occurred' });
        }
    });
    // Preview the generated webapp
    router.get('/preview', (req, res) => {
        try {
            const previewUrl = `http://localhost:8080`;
            res.json({ success: true, previewUrl });
        }
        catch (error) {
            console.error('Error starting preview server:', error);
            res.status(500).json({ error: error.message || 'An unknown error occurred' });
        }
    });
    return router;
}
//# sourceMappingURL=api.js.map