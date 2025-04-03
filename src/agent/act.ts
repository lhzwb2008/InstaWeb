import { OpenRouterApiHandler } from '../api/openrouter.js';
import { getActSystemPrompt } from '../utils/prompt.js';
import { parseFileStructure, writeFiles } from '../utils/file.js';

/**
 * Run the Act phase
 * @param planData The data from the Plan phase
 * @param outputDir The output directory
 * @param apiHandler The OpenAI API handler
 */
export async function runActPhase(
  planData: any, 
  outputDir: string, 
  apiHandler: OpenRouterApiHandler
): Promise<void> {
  console.log('生成WebApp代码...');
  
  try {
    // Generate code
    let generationResult = '';
    apiHandler.on('data', (chunk) => {
      console.log('接收数据中...');
    });
    
    generationResult = await apiHandler.createChatCompletion(
      getActSystemPrompt(planData),
      [{ role: 'user', content: '根据计划生成WebApp代码。' }]
    );
    
    console.log('WebApp代码已生成');
    
    // Parse file structure
    console.log('解析文件结构...');
    
    const files = parseFileStructure(generationResult);
    
    if (files.length === 0) {
      console.error('在生成的代码中未找到文件');
      console.error('模型未生成任何有效文件。请重试。');
      return;
    }
    
    console.log(`找到${files.length}个要创建的文件`);
    
    // Write files
    console.log('写入文件...');
    
    await writeFiles(files, outputDir);
    
    console.log(`WebApp已成功生成在${outputDir}`);
    
  } catch (error) {
    console.error('生成WebApp失败');
    console.error(error);
    throw error;
  }
}
