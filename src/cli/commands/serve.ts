import { createServer } from '../../utils/file.js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

/**
 * Command to serve the generated webapp
 * @param options Command options
 */
export async function serveCommand(
  options: { port?: string, dir?: string }
): Promise<void> {
  console.log(chalk.bold('\n🌐 WebGen - 本地服务器'));
  
  try {
    // Determine directory to serve
    let directory = options.dir || './webapp-output';
    let absoluteDirectory = path.isAbsolute(directory) 
      ? directory 
      : path.resolve(process.cwd(), directory);
    
    // Check if directory exists
    if (!await fs.pathExists(absoluteDirectory)) {
      console.error(chalk.red(`错误: 目录 '${directory}' 不存在`));
      console.log(`运行 ${chalk.cyan('webgen create "您的描述"')} 来先生成一个 WebApp`);
      return;
    }
    
    // If no specific directory is provided and we're using the default webapp-output directory,
    // try to find the most recent webapp directory
    if (!options.dir && directory === './webapp-output') {
      try {
        const baseDir = absoluteDirectory;
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        
        // Filter for directories that match our webapp pattern
        const webappDirs = entries
          .filter(entry => entry.isDirectory() && entry.name.startsWith('webapp-'))
          .map(entry => ({
            name: entry.name,
            path: path.join(baseDir, entry.name),
            // Extract timestamp from directory name
            timestamp: entry.name.replace('webapp-', '')
          }))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort by timestamp (newest first)
        
        if (webappDirs.length > 0) {
          // Use the most recent webapp directory
          absoluteDirectory = webappDirs[0].path;
          console.log(chalk.blue(`找到最新的 WebApp 目录: ${webappDirs[0].name}`));
        }
      } catch (err) {
        console.log(chalk.yellow('无法确定最新的 WebApp 目录，使用默认目录'));
      }
    }
    
    // Check if index.html exists
    const indexPath = path.join(absoluteDirectory, 'index.html');
    if (!await fs.pathExists(indexPath)) {
      console.error(chalk.yellow(`警告: 在 ${directory} 中未找到 index.html`));
      console.log(chalk.gray('服务器仍将启动，但您可能需要导航到特定文件'));
    }
    
    // Determine port
    const port = parseInt(options.port || '8080', 10);
    
    // Start server
    await createServer(absoluteDirectory, port);
    
  } catch (error) {
    console.error(chalk.red('错误:'), error);
    process.exit(1);
  }
}
