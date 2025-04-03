# InstaWeb API 文档

本文档详细介绍了 InstaWeb 的 API 端点、参数和响应格式，以及如何使用 Socket.IO 获取实时更新。

## 配置

InstaWeb 使用 `config.json` 文件进行配置，该文件位于项目根目录下。首次克隆项目后，需要从模板创建配置文件：

```bash
# 创建配置文件
cp config.json.template config.json
```

然后编辑配置文件，设置您的 API 密钥和其他配置项：

```json
{
  "api": {
    "key": "your-openrouter-api-key"
  },
  "access": {
    "ip": "127.0.0.1"
  },
  "preview": {
    "host": "0.0.0.0",
    "port": 8080
  },
  "server": {
    "port": 3001
  },
  "output": {
    "directory": "./webapp-output"
  }
}
```

配置项说明：
- `api.key`: OpenRouter API 密钥
- `access.ip`: 允许访问的 IP 地址
- `preview.host`: 预览服务器主机地址（使用 `0.0.0.0` 允许外部访问）
- `preview.port`: 预览服务器端口
- `server.port`: API 服务器端口
- `output.directory`: 生成的 WebApp 输出目录

注意：配置文件中包含 API 密钥等敏感信息，已添加到 `.gitignore` 中，不会被提交到代码库。

## 响应语言

InstaWeb 的所有 AI 模型响应均为英文，无论用户输入的语言是什么。这确保了系统输出的一致性和可预测性。

## API 端点

### 1. 创建 WebApp

**端点**: `POST /api/create`

**描述**: 根据自然语言描述创建一个新的 WebApp

**请求体**:
```json
{
  "description": "一个简单的待办事项应用，可以添加、删除和标记任务完成"
}
```

**响应**:
```json
{
  "success": true,
  "message": "WebApp generated successfully",
  "files": [
    {
      "name": "index.html",
      "content": "<!DOCTYPE html>...",
      "path": "/path/to/file"
    },
    {
      "name": "styles.css",
      "content": "body {...",
      "path": "/path/to/file"
    },
    {
      "name": "script.js",
      "content": "document.addEventListener...",
      "path": "/path/to/file"
    }
  ],
  "outputDir": "/path/to/output/directory"
}
```

**示例请求**:
```javascript
fetch('/api/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    description: '一个简单的待办事项应用，可以添加、删除和标记任务完成'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### 2. 预览 WebApp

**端点**: `GET /api/preview`

**描述**: 获取生成的 WebApp 的预览 URL，并启动预览服务器

**响应**:
```json
{
  "success": true,
  "previewUrl": "http://localhost:8080"
}
```

**示例请求**:
```javascript
fetch('/api/preview')
.then(response => response.json())
.then(data => {
  console.log(data);
  if (data.success) {
    window.open(data.previewUrl, '_blank');
  }
})
.catch(error => console.error('Error:', error));
```

### 3. 验证 WebApp

**端点**: `POST /api/validate`

**描述**: 验证生成的 WebApp 是否正常运行

**响应**:
```json
{
  "success": true,
  "message": "WebApp validated successfully. No errors found.",
  "logs": [
    "Page loaded successfully",
    "All resources loaded without errors",
    "No JavaScript errors detected",
    "UI elements rendered correctly"
  ]
}
```

**示例请求**:
```javascript
fetch('/api/validate', {
  method: 'POST'
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### 4. 处理反馈

**端点**: `POST /api/feedback`

**描述**: 处理用户反馈，更新 WebApp 代码

**请求体**:
```json
{
  "feedback": "请添加一个清除所有任务的按钮"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Feedback processed successfully",
  "response": "I've added a clear all tasks button...",
  "updatedFiles": [
    {
      "name": "index.html",
      "content": "<!DOCTYPE html>...",
      "path": "/path/to/file"
    },
    {
      "name": "styles.css",
      "content": "body {...",
      "path": "/path/to/file"
    },
    {
      "name": "script.js",
      "content": "document.addEventListener...",
      "path": "/path/to/file"
    }
  ]
}
```

**示例请求**:
```javascript
fetch('/api/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    feedback: '请添加一个清除所有任务的按钮'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### 5. 获取演示页面

**端点**: `GET /api/demo`

**描述**: 获取 InstaWeb 演示页面

**响应**: HTML 页面

**示例请求**:
```javascript
window.location.href = '/api/demo';
```

## Socket.IO 事件

InstaWeb 使用 Socket.IO 提供实时更新。以下是可用的事件：

### 1. 生成进度事件

**事件名称**: `generation-progress`

**事件类型**:
- `status`: 状态更新
  ```json
  { "type": "status", "data": "Planning phase started" }
  ```
- `data`: 生成的文本片段
  ```json
  { "type": "data", "data": "生成的文本片段" }
  ```
- `plan-data`: 计划阶段生成的文本片段
  ```json
  { "type": "plan-data", "data": "计划阶段生成的文本片段" }
  ```
- `plan-complete`: 计划阶段完成
  ```json
  { 
    "type": "plan-complete", 
    "data": { 
      "initialAnalysis": "初始分析结果",
      "answers": { "question_1": "答案1", "question_2": "答案2" },
      "plan": "实施计划"
    } 
  }
  ```
- `generation-complete`: 生成阶段完成
  ```json
  { 
    "type": "generation-complete", 
    "data": { 
      "files": [
        { "name": "index.html", "content": "...", "path": "..." },
        { "name": "styles.css", "content": "...", "path": "..." },
        { "name": "script.js", "content": "...", "path": "..." }
      ],
      "outputDir": "/path/to/output/directory"
    } 
  }
  ```
- `error`: 错误信息
  ```json
  { "type": "error", "data": "错误消息" }
  ```

### 2. 验证进度事件

**事件名称**: `validation-progress`

**事件类型**:
- `status`: 状态更新
  ```json
  { "type": "status", "data": "Validation started" }
  ```
- `validation-complete`: 验证完成
  ```json
  { 
    "type": "validation-complete", 
    "data": {
      "success": true,
      "message": "WebApp validated successfully. No errors found.",
      "logs": [
        "Page loaded successfully",
        "All resources loaded without errors",
        "No JavaScript errors detected",
        "UI elements rendered correctly"
      ]
    }
  }
  ```

### 3. 反馈处理进度事件

**事件名称**: `feedback-progress`

**事件类型**:
- `status`: 状态更新
  ```json
  { "type": "status", "data": "Processing feedback" }
  ```
- `data`: 生成的文本片段
  ```json
  { "type": "data", "data": "生成的文本片段" }
  ```
- `feedback-complete`: 反馈处理完成
  ```json
  { 
    "type": "feedback-complete", 
    "data": {
      "success": true,
      "message": "Feedback processed successfully",
      "response": "I've added a clear all tasks button...",
      "updatedFiles": [
        { "name": "index.html", "content": "...", "path": "..." },
        { "name": "styles.css", "content": "...", "path": "..." },
        { "name": "script.js", "content": "...", "path": "..." }
      ]
    }
  }
  ```
- `error`: 错误信息
  ```json
  { "type": "error", "data": "错误消息" }
  ```

## 前端集成示例

以下是一个完整的前端集成示例，展示如何使用 InstaWeb API 和 Socket.IO 事件：

```javascript
// 初始化 Socket.IO 连接
const socket = io();

// 监听生成进度
socket.on('generation-progress', (data) => {
  if (data.type === 'data' || data.type === 'plan-data') {
    // 更新生成进度显示
    appendToOutput(data.data);
  } else if (data.type === 'status') {
    // 更新状态信息
    updateStatus(data.data);
  } else if (data.type === 'plan-complete') {
    // 处理计划完成
    handlePlanComplete(data.data);
  } else if (data.type === 'generation-complete') {
    // 处理生成完成
    handleGenerationComplete(data.data);
  } else if (data.type === 'error') {
    // 处理错误
    showError(data.data);
  }
});

// 监听验证进度
socket.on('validation-progress', (data) => {
  if (data.type === 'status') {
    // 更新验证状态
    updateStatus(data.data);
  } else if (data.type === 'validation-complete') {
    // 处理验证完成
    handleValidationComplete(data.data);
  }
});

// 监听反馈处理进度
socket.on('feedback-progress', (data) => {
  if (data.type === 'data') {
    // 更新反馈处理进度
    appendToFeedbackOutput(data.data);
  } else if (data.type === 'status') {
    // 更新状态信息
    updateStatus(data.data);
  } else if (data.type === 'feedback-complete') {
    // 处理反馈完成
    handleFeedbackComplete(data.data);
  } else if (data.type === 'error') {
    // 处理错误
    showError(data.data);
  }
});

// 创建 WebApp
async function createWebApp(description) {
  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create WebApp');
    }
    
    return result;
  } catch (error) {
    console.error('Error creating WebApp:', error);
    throw error;
  }
}

// 获取预览 URL
async function getPreviewUrl() {
  try {
    const response = await fetch('/api/preview');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get preview URL');
    }
    
    return result.previewUrl;
  } catch (error) {
    console.error('Error getting preview URL:', error);
    throw error;
  }
}

// 验证 WebApp
async function validateWebApp() {
  try {
    const response = await fetch('/api/validate', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    return result;
  } catch (error) {
    console.error('Error validating WebApp:', error);
    throw error;
  }
}

// 提交反馈
async function submitFeedback(feedback) {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ feedback })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to process feedback');
    }
    
    return result;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

// 示例用法
document.getElementById('createButton').addEventListener('click', async () => {
  const description = document.getElementById('description').value;
  
  try {
    // 显示加载状态
    showLoading(true);
    
    // 创建 WebApp
    await createWebApp(description);
    
    // 注意：不需要在这里处理结果，因为 Socket.IO 事件会处理实时更新
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
});

document.getElementById('previewButton').addEventListener('click', async () => {
  try {
    const previewUrl = await getPreviewUrl();
    window.open(previewUrl, '_blank');
  } catch (error) {
    showError(error.message);
  }
});

document.getElementById('validateButton').addEventListener('click', async () => {
  try {
    showLoading(true);
    await validateWebApp();
    // 注意：不需要在这里处理结果，因为 Socket.IO 事件会处理实时更新
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
});

document.getElementById('feedbackButton').addEventListener('click', async () => {
  const feedback = document.getElementById('feedback').value;
  
  try {
    showLoading(true);
    await submitFeedback(feedback);
    // 注意：不需要在这里处理结果，因为 Socket.IO 事件会处理实时更新
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
});
```

## 部署说明

### 1. 安装依赖

```bash
npm install
```

### 2. 配置

编辑 `config.json` 文件，设置 API 密钥、预览服务器主机地址和端口等。

### 3. 启动服务器

```bash
npm start
```

默认情况下，API 服务器将在 `http://localhost:3001` 上运行，预览服务器将在 `http://localhost:8080` 上运行。

### 4. 外部访问

如果要允许外部访问，请将 `preview.host` 和 `server.host` 设置为 `0.0.0.0`，并确保防火墙允许相应端口的访问。

## 错误处理

所有 API 端点在出错时都会返回一个包含 `error` 字段的 JSON 响应，HTTP 状态码为 4xx 或 5xx。

```json
{
  "error": "错误消息"
}
```

Socket.IO 事件也会发送错误信息：

```json
{ "type": "error", "data": "错误消息" }
```

在前端代码中，应该适当处理这些错误并向用户显示友好的错误消息。
