import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { getPreviewHost, getPreviewPort } from './config.js';

/**
 * Interface for file information
 */
export interface FileInfo {
  path: string;
  content: string;
}

/**
 * Parse file structure and content from the model's response
 * @param generationResult The model's response
 * @returns Array of file information
 */
export function parseFileStructure(generationResult: string): FileInfo[] {
  const files: FileInfo[] = [];
  
  // Extract file paths from the response
  const filePathRegex = /([a-zA-Z0-9_\-./]+\.(html|css|js))/g;
  const filePaths = [...generationResult.matchAll(filePathRegex)].map(m => m[0]);
  
  // Extract HTML files
  const htmlRegex = /```html\s+([\s\S]*?)```/g;
  let match;
  let htmlIndex = 0;
  while ((match = htmlRegex.exec(generationResult)) !== null) {
    const content = match[1].trim();
    // Find a matching path or create a default one
    const path = filePaths.find(p => p.endsWith('.html')) || `index${htmlIndex ? htmlIndex : ''}.html`;
    files.push({ path, content });
    htmlIndex++;
  }
  
  // Extract CSS files
  const cssRegex = /```css\s+([\s\S]*?)```/g;
  let cssIndex = 0;
  while ((match = cssRegex.exec(generationResult)) !== null) {
    const content = match[1].trim();
    const path = filePaths.find(p => p.endsWith('.css')) || `styles${cssIndex ? cssIndex : ''}.css`;
    files.push({ path, content });
    cssIndex++;
  }
  
  // Extract JS files
  const jsRegex = /```js(?:cript)?\s+([\s\S]*?)```/g;
  let jsIndex = 0;
  while ((match = jsRegex.exec(generationResult)) !== null) {
    const content = match[1].trim();
    const path = filePaths.find(p => p.endsWith('.js')) || `script${jsIndex ? jsIndex : ''}.js`;
    files.push({ path, content });
    jsIndex++;
  }
  
  return files;
}

/**
 * Write files to the output directory
 * @param files Array of file information
 * @param outputDir Output directory
 */
export async function writeFiles(files: FileInfo[], outputDir: string): Promise<void> {
  // Ensure output directory exists
  await fs.ensureDir(outputDir);
  
  // Write each file
  for (const file of files) {
    const filePath = path.join(outputDir, file.path);
    
    // Ensure directory for the file exists
    await fs.ensureDir(path.dirname(filePath));
    
    // Write file
    await fs.writeFile(filePath, file.content);
    
    console.log(`${chalk.green('✓')} Created ${chalk.cyan(file.path)}`);
  }
}

/**
 * Create a simple Express server to serve the generated files
 * @param outputDir Output directory
 * @param port Port number (optional, defaults to config value)
 * @param host Host address (optional, defaults to config value)
 */
export async function createServer(
  outputDir: string, 
  port?: number,
  host?: string
): Promise<void> {
  // Use provided values or defaults from config
  const serverPort = port || getPreviewPort();
  const serverHost = host || getPreviewHost();
  
  // Dynamically import express (ES module way)
  const expressModule = await import('express');
  const express = expressModule.default;
  
  const app = express();
  
  // Serve static files from the output directory
  app.use(express.static(outputDir));
  
  // Start the server
  app.listen(serverPort, serverHost, () => {
    console.log(`${chalk.green('✓')} Server running at ${chalk.cyan(`http://${serverHost === '0.0.0.0' ? 'localhost' : serverHost}:${serverPort}`)}`);
    console.log(`${chalk.green('✓')} Serving files from ${chalk.cyan(outputDir)}`);
    
    // If binding to all interfaces, also show the external URL
    if (serverHost === '0.0.0.0') {
      console.log(`${chalk.green('✓')} External access: ${chalk.cyan(`http://<your-ip-address>:${serverPort}`)}`);
    }
  });
}
