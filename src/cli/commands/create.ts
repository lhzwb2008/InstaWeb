import { OpenRouterApiHandler } from '../../api/openrouter.js';
import { runPlanPhase } from '../../agent/plan.js';
import { runActPhase } from '../../agent/act.js';
import { getApiKey, getDefaultOutputDir } from '../../utils/config.js';
import chalk from 'chalk';
import path from 'path';

/**
 * Command to create a new webapp
 * @param description The webapp description
 * @param options Command options
 */
export async function createCommand(
  description: string, 
  options: { output?: string }
): Promise<void> {
  console.log(chalk.bold('\n🚀 WebGen - WebApp 生成器'));
  console.log(chalk.gray('将您的描述转换为完整的 WebApp\n'));
  
  try {
    // Get API key
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error(chalk.red('错误: OpenRouter API key 未设置'));
      console.log(`运行 ${chalk.cyan('webgen config')} 来设置您的 API key`);
      return;
    }
    
    // Determine output directory
    const outputDir = options.output || getDefaultOutputDir();
    const absoluteOutputDir = path.isAbsolute(outputDir) 
      ? outputDir 
      : path.resolve(process.cwd(), outputDir);
    
    // Create API handler
    const apiHandler = new OpenRouterApiHandler(apiKey);
    
    // Run Plan phase
    console.log(chalk.bold('📝 规划阶段: 分析需求并创建计划'));
    const planData = await runPlanPhase(description, apiHandler);
    
    console.log('\n' + chalk.bold('🛠️ 执行阶段: 生成 WebApp 代码'));
    
    // Run Act phase
    await runActPhase(planData, absoluteOutputDir, apiHandler);
    
  } catch (error) {
    console.error(chalk.red('错误:'), error);
    process.exit(1);
  }
}
