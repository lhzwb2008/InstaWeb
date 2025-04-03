import { OpenRouterApiHandler } from '../api/openrouter.js';
import { getPlanSystemPrompt, getPlanFinalSystemPrompt } from '../utils/prompt.js';

/**
 * Interface for question data
 */
interface Question {
  id: string;
  text: string;
}

/**
 * Extract questions from the model's response
 * @param analysis The model's response
 * @returns Array of questions
 */
function extractQuestions(analysis: string): Question[] {
  // Find the "关键问题" section
  const questionsSection = analysis.split('关键问题:')[1];
  if (!questionsSection) return [];
  
  // Extract numbered questions
  const questionRegex = /\d+\.\s*(.*?)(?=\d+\.|$)/g;
  const matches = Array.from(questionsSection.matchAll(questionRegex));
  
  return matches.map((match, index) => ({
    id: `question_${index + 1}`,
    text: match[1].trim()
  }));
}

/**
 * Format answers for display
 * @param answers The user's answers
 * @returns Formatted answers string
 */
function formatAnswers(answers: Record<string, string>): string {
  return Object.entries(answers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

/**
 * Run the Plan phase
 * @param description The webapp description
 * @param apiHandler The OpenAI API handler
 * @returns The plan data
 */
export async function runPlanPhase(description: string, apiHandler: OpenRouterApiHandler): Promise<any> {
  console.log('分析您的需求...');
  
  try {
    // Initial analysis
    let analysisResult = '';
    apiHandler.on('data', (chunk) => {
      console.log('接收数据中...');
    });
    
    analysisResult = await apiHandler.createChatCompletionWithSearch(
      getPlanSystemPrompt(description),
      [{ role: 'user', content: `我需要一个WebApp，描述如下: ${description}` }]
    );
    
    console.log('需求分析完成');
    console.log('初步分析:');
    console.log(analysisResult);
    
    // Extract questions
    const questions = extractQuestions(analysisResult);
    
    if (questions.length === 0) {
      console.error('在分析中未找到问题');
      return {
        description,
        initialAnalysis: analysisResult,
        answers: {},
        plan: '由于缺少问题，未生成计划'
      };
    }
    
    console.log('找到以下问题:');
    questions.forEach(q => console.log(`- ${q.text}`));
    
    // Generate default answers
    const answers: Record<string, string> = {};
    
    questions.forEach(q => {
      // Default answers based on question content
      if (q.text.toLowerCase().includes('数据持久化') || 
          q.text.toLowerCase().includes('persistence') || 
          q.text.toLowerCase().includes('storage')) {
        answers[q.id] = 'Yes, use localStorage';
      } else if (q.text.toLowerCase().includes('分类') || 
                q.text.toLowerCase().includes('categories')) {
        answers[q.id] = 'No, keep it simple';
      } else if (q.text.toLowerCase().includes('响应式') || 
                q.text.toLowerCase().includes('responsive') || 
                q.text.toLowerCase().includes('mobile')) {
        answers[q.id] = 'Yes, make it responsive';
      } else {
        answers[q.id] = 'Yes';
      }
    });
    
    console.log('使用默认答案:');
    console.log(formatAnswers(answers));
    
    // Generate final plan
    console.log('创建实施计划...');
    
    let finalPlan = '';
    apiHandler.on('data', (chunk) => {
      console.log('接收数据中...');
    });
    
    finalPlan = await apiHandler.createChatCompletionWithSearch(
      getPlanFinalSystemPrompt(description, answers),
      [
        { role: 'user', content: `我需要一个WebApp，描述如下: ${description}` },
        { role: 'assistant', content: analysisResult },
        { role: 'user', content: `我的回答:\n${formatAnswers(answers)}` }
      ]
    );
    
    console.log('实施计划已创建');
    console.log('实施计划:');
    console.log(finalPlan);
    
    return {
      description,
      initialAnalysis: analysisResult,
      answers,
      plan: finalPlan
    };
  } catch (error) {
    console.error('分析需求失败');
    console.error(error);
    throw error;
  }
}
