import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source and destination directories
const sourceDir = path.join(__dirname, 'web', 'client');
const destDir = path.join(__dirname, 'dist', 'web', 'client');

// Create the destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy all files from the source directory to the destination directory
function copyFiles(source, dest) {
  // Get all files in the source directory
  const files = fs.readdirSync(source);
  
  // Copy each file to the destination directory
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const destPath = path.join(dest, file);
    
    // Check if the file is a directory
    if (fs.statSync(sourcePath).isDirectory()) {
      // Create the destination directory if it doesn't exist
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      
      // Recursively copy files in the directory
      copyFiles(sourcePath, destPath);
    } else {
      // Copy the file
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);
    }
  }
}

// Copy the files
copyFiles(sourceDir, destDir);

console.log(`Successfully copied web/client to dist/web/client`);
