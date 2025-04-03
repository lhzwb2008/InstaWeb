#!/usr/bin/env node

import { Command } from 'commander';
import { createCommand } from './commands/create.js';
import { configCommand } from './commands/config.js';
import { serveCommand } from './commands/serve.js';
import chalk from 'chalk';

// Create the program
const program = new Command();

// Set program metadata
program
  .name('webgen')
  .description('从自然语言描述生成完整的网页应用')
  .version('1.0.0');

// Create command
program
  .command('create')
  .description('从描述创建一个新的网页应用')
  .argument('<description>', '您想要创建的网页应用的描述')
  .option('-o, --output <directory>', '生成的网页应用的输出目录')
  .action(createCommand);

// Config command
program
  .command('config')
  .description('配置 webgen 设置')
  .action(configCommand);

// Serve command
program
  .command('serve')
  .description('启动本地服务器来预览生成的网页应用')
  .option('-p, --port <number>', '端口号', '8080')
  .option('-d, --dir <directory>', '要服务的目录', './webapp-output')
  .action(serveCommand);

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`\n错误: 无效命令: ${program.args.join(' ')}`));
  console.log(`查看 ${chalk.cyan('webgen --help')} 获取可用命令列表。`);
  process.exit(1);
});

// Parse arguments
program.parse();

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}
