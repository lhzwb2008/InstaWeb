/**
 * This is a simplified implementation of the OpenRouterApiHandler and related functions.
 * We're creating this because Node.js cannot directly import TypeScript files without transpilation.
 */

import EventEmitter from 'events';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Import config values directly instead of from the TypeScript file
const getApiKey = () => {
  try {
    const configPath = path.resolve(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return configData.api?.key || '';
    }
  } catch (error) {
    console.error('Error loading API key from config:', error);
  }
  return '';
};

const getOutputDirectory = () => {
  try {
    const configPath = path.resolve(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return configData.output?.directory || './webapp-output';
    }
  } catch (error) {
    console.error('Error loading output directory from config:', error);
  }
  return './webapp-output';
};

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handler for OpenRouter API communication with Claude 3.7
 * Extends EventEmitter to emit events during streaming
 */
export class OpenRouterApiHandler extends EventEmitter {
  constructor(apiKey) {
    super();
    
    // Use provided API key or get from config
    this.apiKey = apiKey || getApiKey();
    
    // Validate API key format
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('API key is required. Please provide an API key or set it in the config file.');
    }
    
    // Log for debugging
    console.log(`Using API key: ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: this.apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://webgen.example.com",
        "X-Title": "WebApp Generator",
      },
    });
  }
  
  /**
   * Create a chat completion with the OpenRouter API using Claude 3.7
   */
  async createChatCompletion(systemPrompt, messages, model = "anthropic/claude-3.7-sonnet") {
    try {
      // Add instruction to respond in English
      const enhancedSystemPrompt = `${systemPrompt}\n\nPlease respond in English.`;
      
      // Format messages for OpenRouter API
      const formattedMessages = [
        { role: "system", content: enhancedSystemPrompt },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 
                m.role === 'assistant' ? 'assistant' : 
                m.role === 'system' ? 'system' : 'user',
          content: m.content
        }))
      ];
      
      // Print request details for debugging
      console.log("\n=== REQUEST DETAILS ===");
      console.log("URL:", "https://openrouter.ai/api/v1/chat/completions");
      console.log("Headers:");
      console.log({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
        'HTTP-Referer': 'https://webgen.example.com',
        'X-Title': 'WebApp Generator'
      });
      console.log("Body:");
      console.log(JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true,
      }, null, 2));
      console.log("======================\n");
      
      // Create the completion with streaming
      const stream = await this.client.chat.completions.create({
        model: model,
        messages: formattedMessages,
        stream: true,
      });
      
      let result = '';
      
      // Log for debugging
      console.log('Stream started, emitting data events...');
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          result += content;
          console.log('Emitting data:', content.substring(0, 20) + (content.length > 20 ? '...' : ''));
          this.emit('data', content);
        }
      }
      
      console.log('Stream completed, total content length:', result.length);
      
      return result;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw error;
    }
  }
  
  /**
   * Create a chat completion with online search capability
   * @param systemPrompt The system prompt
   * @param messages The conversation history
   * @param model The model to use (defaults to Claude-3.7-Sonnet)
   * @returns The generated text
   */
  async createChatCompletionWithSearch(
    systemPrompt, 
    messages,
    model = "anthropic/claude-3.7-sonnet:online"
  ) {
    try {
      // Add instruction to respond in English
      const enhancedSystemPrompt = `${systemPrompt}\n\nPlease respond in English.`;
      
      // Format messages for OpenRouter API
      const formattedMessages = [
        { role: "system", content: enhancedSystemPrompt },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 
                m.role === 'assistant' ? 'assistant' : 
                m.role === 'system' ? 'system' : 'user',
          content: m.content
        }))
      ];
      
      // Print request details for debugging
      console.log("\n=== REQUEST DETAILS ===");
      console.log("URL:", "https://openrouter.ai/api/v1/chat/completions");
      console.log("Headers:");
      console.log({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
        'HTTP-Referer': 'https://webgen.example.com',
        'X-Title': 'WebApp Generator'
      });
      console.log("Body:");
      console.log(JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true,
      }, null, 2));
      console.log("======================\n");
      
      // Create the completion with streaming and online search
      const stream = await this.client.chat.completions.create({
        model: model, // Use the online version of Claude 3.7
        messages: formattedMessages,
        stream: true,
      });
      
      let result = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          result += content;
          this.emit('data', content);
        }
      }
      
      return result;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw error;
    }
  }
  
  /**
   * Get the API key
   * @returns The API key
   */
  getApiKey() {
    return this.apiKey;
  }
}

/**
 * Run the planning phase to analyze requirements and create a plan
 */
export async function runPlanPhase(description, apiHandler) {
  console.log('Running plan phase for:', description);
  
  try {
    // System prompt for the planning phase
    const systemPrompt = `
You are a web application architect and developer. Your task is to analyze the user's requirements for a web application and create a detailed plan for implementation.

Please respond in English.

Follow these steps:
1. Analyze the requirements and create a detailed analysis document
2. Identify key questions that need to be answered
3. Create a detailed implementation plan

Your analysis should include:
- Overview of the application
- Functional requirements
- Technical stack (HTML, CSS, JavaScript)
- UI/UX design considerations

Your plan should include:
- File structure
- Implementation steps
- Responsive design considerations
- Data storage approach
- Testing plan

Format your response in Markdown.
`;

    // User message with the description
    const userMessage = `Please analyze the following web application requirements and create a plan: ${description}`;
    
    // Call the OpenRouter API
    const analysisResult = await apiHandler.createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userMessage }]
    );
    
    console.log('Analysis completed');
    
    // Extract the initial analysis and plan from the result
    // This is a simple extraction, you might need to adjust based on the actual response format
    const sections = analysisResult.split('# ');
    
    let initialAnalysis = '';
    let plan = '';
    
    // Find the analysis and plan sections
    for (const section of sections) {
      if (section.toLowerCase().includes('analysis') || 
          section.toLowerCase().includes('requirements')) {
        initialAnalysis = '# ' + section;
      } else if (section.toLowerCase().includes('plan') || 
                section.toLowerCase().includes('implementation')) {
        plan = '# ' + section;
      }
    }
    
    // If we couldn't extract the sections, use the whole result
    if (!initialAnalysis) {
      initialAnalysis = analysisResult;
    }
    
    if (!plan) {
      plan = analysisResult;
    }
    
    // Extract questions from the analysis
    const questionsSection = initialAnalysis.split('Key Questions:')[1] || '';
    
    const answers = {};
    
    if (questionsSection) {
      const questionRegex = /\d+\.\s*(.*?)(?=\d+\.|$)/g;
      const matches = Array.from(questionsSection.matchAll(questionRegex));
      
      matches.forEach((match, index) => {
        const questionId = `question_${index + 1}`;
        const questionText = match[1] ? match[1].trim() : `Question ${index + 1}`;
        
        // Default answers based on question content
        if (questionText.toLowerCase().includes('persistence') || 
            questionText.toLowerCase().includes('storage')) {
          answers[questionId] = 'Yes, use localStorage';
        } else if (questionText.toLowerCase().includes('categories')) {
          answers[questionId] = 'No, keep it simple';
        } else if (questionText.toLowerCase().includes('responsive') || 
                  questionText.toLowerCase().includes('mobile')) {
          answers[questionId] = 'Yes, make it responsive';
        } else {
          answers[questionId] = 'Yes';
        }
      });
    }
    
    return {
      initialAnalysis,
      answers,
      plan
    };
  } catch (error) {
    console.error('Error in plan phase:', error);
    
    // Return generic fallback data based on the description
    const appName = description.split(' ').slice(0, 3).join(' ') + '...';
    
    return {
      initialAnalysis: `
# WebApp Requirements Analysis: ${appName}

## Overview
The user needs a web application with the following description: "${description}"

## Functional Requirements
1. Implement functionality based on user description
2. Provide an intuitive user interface
3. Ensure good user experience

## Technical Stack
- HTML5
- CSS3
- JavaScript (vanilla)

## UI/UX Design
A clean single-page application including:
- UI elements appropriate for the application functionality
- Responsive design for different devices

## Key Questions:
1. Is data persistence functionality needed?
2. Is responsive design needed for mobile devices?
3. Are any special interaction features needed?
`,
      answers: {
        question_1: 'Yes, use localStorage',
        question_2: 'Yes, make it responsive',
        question_3: 'Yes, implement as needed'
      },
      plan: `
# WebApp Implementation Plan: ${appName}

## File Structure
- index.html - Main HTML file
- styles.css - Stylesheet
- script.js - JavaScript logic

## Implementation Steps
1. Create basic HTML structure
2. Add CSS styles
3. Implement JavaScript functionality
4. Test functionality and responsive design

## Responsive Design
Will use media queries to ensure good experience on mobile devices.

## Local Storage
Will use localStorage API for data persistence.

## Testing Plan
- Test all functionality
- Test compatibility in different browsers
- Test responsive layout
`
    };
  }
}

/**
 * Run the act phase to generate the actual files
 */
export async function runActPhase(planData, outputDir, apiHandler) {
  console.log('Running act phase with plan:', planData);
  console.log('Output directory:', outputDir);
  
  try {
    // System prompt for the act phase
    const systemPrompt = `
You are a web application developer. Your task is to implement a web application based on the provided analysis and plan.

Please respond in English.

You need to create the following files:
1. index.html - The main HTML file
2. styles.css - The CSS styles
3. script.js - The JavaScript code

Follow these guidelines:
- Use modern HTML5, CSS3, and vanilla JavaScript (no frameworks)
- Implement responsive design
- Use localStorage for data persistence if needed
- Ensure the code is clean, well-commented, and follows best practices
- Make sure all files work together correctly

IMPORTANT: You MUST implement the exact application described in the analysis and plan. DO NOT default to creating a todo list or task management app unless that is specifically what was requested.

For each file, provide ONLY the complete code without any explanations or markdown formatting.
`;

    // User message with the plan data
    const userMessage = `
Please implement the web application based on the following analysis and plan:

ANALYSIS:
${planData.initialAnalysis}

PLAN:
${planData.plan}

ANSWERS TO KEY QUESTIONS:
${Object.entries(planData.answers).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Generate the complete HTML, CSS, and JavaScript files for exactly the application described above. DO NOT create a generic todo list app.
`;

    // Call the OpenRouter API with online search capability for better implementation
    const implementationResult = await apiHandler.createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userMessage }],
      "anthropic/claude-3.7-sonnet:online" // Use online version for better code generation
    );
    
    console.log('Implementation completed');
    
    // Extract the HTML, CSS, and JavaScript code from the result
    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';
    
    // Look for HTML code block
    const htmlMatch = implementationResult.match(/```html\s*([\s\S]*?)\s*```/) || 
                     implementationResult.match(/```HTML\s*([\s\S]*?)\s*```/) ||
                     implementationResult.match(/<html[\s\S]*?<\/html>/);
    
    if (htmlMatch) {
      htmlContent = htmlMatch[1] || htmlMatch[0];
    }
    
    // Look for CSS code block
    const cssMatch = implementationResult.match(/```css\s*([\s\S]*?)\s*```/) || 
                    implementationResult.match(/```CSS\s*([\s\S]*?)\s*```/) ||
                    implementationResult.match(/\/\*\s*CSS\s*\*\/\s*([\s\S]*?)(?=```|$)/);
    
    if (cssMatch) {
      cssContent = cssMatch[1] || cssMatch[0];
    }
    
    // Look for JavaScript code block
    const jsMatch = implementationResult.match(/```javascript\s*([\s\S]*?)\s*```/) || 
                   implementationResult.match(/```js\s*([\s\S]*?)\s*```/) ||
                   implementationResult.match(/```JS\s*([\s\S]*?)\s*```/) ||
                   implementationResult.match(/\/\*\s*JavaScript\s*\*\/\s*([\s\S]*?)(?=```|$)/);
    
    if (jsMatch) {
      jsContent = jsMatch[1] || jsMatch[0];
    }
    
    // If we couldn't extract the code, try a different approach
    if (!htmlContent || !cssContent || !jsContent) {
      // Split by file names
      const parts = implementationResult.split(/(?:^|\n)(?:#+\s*|\/\/\s*|\/\*\s*|\*\s*|<!--\s*)(index\.html|styles\.css|script\.js)(?:\s*-->|\s*\*\/)?(?:\n|:)/i);
      
      for (let i = 1; i < parts.length; i += 2) {
        const fileName = parts[i].toLowerCase();
        const content = parts[i + 1]?.trim() || '';
        
        if (fileName === 'index.html') {
          htmlContent = content;
        } else if (fileName === 'styles.css') {
          cssContent = content;
        } else if (fileName === 'script.js') {
          jsContent = content;
        }
      }
    }
    
    // Clean up the extracted code
    htmlContent = htmlContent.replace(/```html|```HTML|```/g, '').trim();
    cssContent = cssContent.replace(/```css|```CSS|```/g, '').trim();
    jsContent = jsContent.replace(/```javascript|```js|```JS|```/g, '').trim();
    
    // If we still don't have valid content, use fallback templates
    if (!htmlContent.includes('<html') || !htmlContent.includes('</html>')) {
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated WebApp</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Generated WebApp</h1>
        <div class="content">
            <!-- Content will be generated here -->
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`;
    }
    
    if (!cssContent || cssContent.length < 50) {
      cssContent = `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
    padding: 20px;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background-color: white;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    padding: 20px;
}

h1 {
    text-align: center;
    margin-bottom: 20px;
    color: #333;
}

@media (max-width: 480px) {
    .container {
        width: 100%;
        padding: 10px;
    }
}`;
    }
    
    if (!jsContent || jsContent.length < 50) {
      jsContent = `
document.addEventListener('DOMContentLoaded', () => {
    console.log('WebApp initialized');
    // JavaScript functionality will be implemented here
});`;
    }
    
    // Write files
    fs.writeFileSync(path.join(outputDir, 'index.html'), htmlContent);
    fs.writeFileSync(path.join(outputDir, 'styles.css'), cssContent);
    fs.writeFileSync(path.join(outputDir, 'script.js'), jsContent);
    
    return true;
  } catch (error) {
    console.error('Error in act phase:', error);
    
    // Fallback to default files
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebApp</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>WebApp</h1>
        <div class="content">
            <p>This is a fallback template. The actual generation failed.</p>
            <p>Error: ${error.message}</p>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`;
    
    const cssContent = `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
    padding: 20px;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background-color: white;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    padding: 20px;
}

h1 {
    text-align: center;
    margin-bottom: 20px;
    color: #333;
}

.content {
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f8f9fa;
}

.content p {
    margin-bottom: 10px;
}

@media (max-width: 480px) {
    .container {
        width: 100%;
        padding: 10px;
    }
}`;
    
    const jsContent = `
document.addEventListener('DOMContentLoaded', () => {
    console.log('WebApp initialized (fallback)');
});`;
    
    // Write fallback files
    fs.writeFileSync(path.join(outputDir, 'index.html'), htmlContent);
    fs.writeFileSync(path.join(outputDir, 'styles.css'), cssContent);
    fs.writeFileSync(path.join(outputDir, 'script.js'), jsContent);
    
    return false;
  }
}

// Export a simple test function to verify the module is loaded correctly
export function testApiWrapper() {
  console.log('API Wrapper module loaded successfully!');
  console.log('OpenRouterApiHandler available:', !!OpenRouterApiHandler);
  console.log('runPlanPhase available:', !!runPlanPhase);
  console.log('runActPhase available:', !!runActPhase);
  return true;
}
