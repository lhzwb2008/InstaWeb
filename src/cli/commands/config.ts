import inquirer from 'inquirer';
import { getApiKey, setApiKey, getDefaultOutputDir, setDefaultOutputDir } from '../../utils/config.js';
import chalk from 'chalk';

/**
 * Command to configure the tool settings
 */
export async function configCommand(): Promise<void> {
  console.log(chalk.bold('\n🔧 WebGen 配置\n'));
  
  const currentApiKey = getApiKey();
  const currentOutputDir = getDefaultOutputDir();
  
  // Show current configuration
  console.log('当前配置:');
  console.log(`OpenRouter API Key: ${currentApiKey ? chalk.green('已设置') + ' ' + chalk.gray('(' + currentApiKey.substring(0, 4) + '...' + currentApiKey.substring(currentApiKey.length - 4) + ')') : chalk.red('未设置')}`);
  console.log(`默认输出目录: ${chalk.cyan(currentOutputDir)}`);
  
  // Ask what to configure
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '您想配置什么?',
      choices: [
        { name: '设置 OpenRouter API Key', value: 'apiKey' },
        { name: '设置默认输出目录', value: 'outputDir' },
        { name: '退出', value: 'exit' }
      ]
    }
  ]);
  
  if (action === 'exit') {
    return;
  }
  
  if (action === 'apiKey') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: '输入您的 OpenRouter API Key:',
        validate: (input) => {
          if (input.trim() === '') return 'API Key 不能为空';
          
          // Basic validation for API key length
          if (input.trim().length < 20) {
            return 'API key 似乎太短了。请检查您的密钥。';
          }
          
          return true;
        }
      }
    ]);
    
    const trimmedKey = apiKey.trim();
    setApiKey(trimmedKey);
    console.log(chalk.green('\n✓ API Key 保存成功'));
    console.log(`Key 格式: ${trimmedKey.substring(0, 6)}...${trimmedKey.substring(trimmedKey.length - 4)}`);
  }
  
  if (action === 'outputDir') {
    const { outputDir } = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputDir',
        message: '输入默认输出目录:',
        default: currentOutputDir,
        validate: (input) => input.trim() !== '' ? true : '输出目录不能为空'
      }
    ]);
    
    setDefaultOutputDir(outputDir.trim());
    console.log(chalk.green('\n✓ 默认输出目录保存成功'));
  }
}
