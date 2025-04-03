# WebGen Web Interface

This is a web interface for the WebGen tool, which generates complete web applications from natural language descriptions using Claude 3.7 via OpenRouter.

## Project Structure

The project is divided into two main parts:

- **Client**: A React application built with Vite, TypeScript, and React Bootstrap
- **Server**: An Express server that handles API requests and communicates with the WebGen core

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm

### Installation

1. Install dependencies for both client and server:

```bash
npm run install-all
```

2. Build the client and server:

```bash
npm run build
```

3. Start the server:

```bash
npm start
```

The application will be available at http://localhost:3001

### Development

To run both client and server in development mode:

```bash
npm run dev
```

This will start:
- Client development server at http://localhost:3000
- Server at http://localhost:3001

## Features

- **User-friendly Interface**: Simple form to input API key and application description
- **Real-time Updates**: See the generation process in real-time
- **Interactive Requirements Refinement**: Answer questions to refine your requirements
- **Code Preview**: View and browse generated files
- **One-click Preview**: Preview the generated application in a new tab

## How It Works

1. User enters their OpenRouter API key and a description of the web application they want to create
2. The server sends the request to Claude 3.7 via OpenRouter
3. The model analyzes the requirements and may ask clarifying questions
4. After the user answers the questions, the model generates a plan
5. The model then generates the actual code files
6. The files are saved to the server and displayed in the UI
7. The user can preview the application with one click

## Technologies Used

- **Frontend**: React, TypeScript, React Bootstrap, Socket.io Client
- **Backend**: Express, TypeScript, Socket.io
- **API**: OpenRouter (Claude 3.7)
