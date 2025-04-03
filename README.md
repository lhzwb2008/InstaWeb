# InstaWeb - WebApp Generator

InstaWeb 是一个基于 AI 的 WebApp 生成器，可以将自然语言描述转换为完整的网页应用。它使用 Claude 3.7 模型通过 OpenRouter API 来分析需求、制定计划并生成代码。

## 特点

- 使用自然语言描述生成完整的 WebApp
- 两阶段生成过程：计划阶段和执行阶段
- 生成纯 HTML、CSS 和 JavaScript 代码，无需额外依赖
- 支持实时流式输出，可以看到生成过程
- 提供预览服务，可以立即查看生成的 WebApp
- 支持反馈处理，可以根据反馈修改生成的代码
- 支持外部访问预览服务，方便在不同设备上测试
- 提供完整的 API 和演示页面
- 所有模型输出均为英文，确保一致性

## 安装

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/InstaWeb.git
cd InstaWeb
```

2. 安装依赖：

```bash
npm install
```

3. 编译 TypeScript 代码：

```bash
npm run build
```

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
- `api.key`: OpenRouter API 密钥，用于访问 Claude 3.7 模型
- `access.ip`: 允许访问的 IP 地址
- `preview.host`: 预览服务器主机地址（使用 `0.0.0.0` 允许外部访问）
- `preview.port`: 预览服务器端口
- `server.port`: API 服务器端口
- `output.directory`: 生成的 WebApp 输出目录

注意：配置文件中包含 API 密钥等敏感信息，已添加到 `.gitignore` 中，不会被提交到代码库。

## 使用方法

### 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3001` 上运行。

### 访问演示页面

启动服务器后，可以通过以下 URL 访问演示页面：

```
http://localhost:3001/api/demo
```

或者直接访问根路径，会自动重定向到演示页面：

```
http://localhost:3001
```

### 使用 API

InstaWeb 提供了一组 API 端点，可以通过 HTTP 请求使用：

#### 1. 创建 WebApp

```
POST /api/create
```

请求体：

```json
{
  "description": "一个简单的待办事项应用，可以添加、删除和标记任务完成"
}
```

#### 2. 预览 WebApp

```
GET /api/preview
```

#### 3. 验证 WebApp

```
POST /api/validate
```

#### 4. 处理反馈

```
POST /api/feedback
```

请求体：

```json
{
  "feedback": "请添加一个清除所有任务的按钮"
}
```

### 实时更新

InstaWeb 使用 Socket.IO 提供实时更新。前端可以监听以下事件：

- `generation-progress`: 生成进度事件
- `validation-progress`: 验证进度事件
- `feedback-progress`: 反馈处理进度事件

详细的 API 文档请参考 [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)。

## 示例

以下是一个简单的使用示例：

1. 启动服务器：

```bash
npm start
```

2. 访问演示页面：

```
http://localhost:3001/api/demo
```

3. 在演示页面中，输入 WebApp 描述，例如：

```
一个简单的计算器应用，支持加减乘除基本运算
```

4. 点击 "Create WebApp" 按钮，等待生成完成。

5. 点击 "Preview WebApp" 按钮，在新窗口中查看生成的 WebApp。

6. 如果需要修改，可以在 "Feedback" 标签页中提供反馈，例如：

```
请添加一个清除所有计算的按钮
```

7. 点击 "Submit Feedback" 按钮，等待处理完成。

8. 再次点击 "Preview WebApp" 按钮，查看更新后的 WebApp。

## 外部访问

如果要允许外部访问，请在 `config.json` 文件中将 `preview.host` 和 `server.host` 设置为 `0.0.0.0`，并确保防火墙允许相应端口的访问。

然后，其他设备可以通过以下 URL 访问：

```
http://<your-ip-address>:3001/api/demo
```

## 前端集成

InstaWeb 可以轻松集成到前端应用中。以下是一个简单的 JavaScript 示例：

```javascript
// 初始化 Socket.IO 连接
const socket = io('http://localhost:3001');

// 监听生成进度
socket.on('generation-progress', (data) => {
  if (data.type === 'data') {
    console.log('生成数据:', data.data);
  } else if (data.type === 'status') {
    console.log('状态更新:', data.data);
  } else if (data.type === 'generation-complete') {
    console.log('生成完成:', data.data);
  }
});

// 创建 WebApp
async function createWebApp(description) {
  const response = await fetch('http://localhost:3001/api/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ description })
  });
  
  return await response.json();
}

// 获取预览 URL
async function getPreviewUrl() {
  const response = await fetch('http://localhost:3001/api/preview');
  const result = await response.json();
  
  if (result.success) {
    window.open(result.previewUrl, '_blank');
  }
  
  return result;
}
```

## 许可证

MIT
