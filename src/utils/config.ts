import fs from 'fs';
import path from 'path';

// Paths to the configuration files
const CONFIG_FILE_PATH = path.resolve(process.cwd(), 'config.json');
const CONFIG_TEMPLATE_PATH = path.resolve(process.cwd(), 'config.json.template');

/**
 * Configuration interface
 */
interface Config {
  api: {
    key: string;
  };
  access?: {
    ip: string;
  };
  preview: {
    host: string;
    port: number;
  };
  server: {
    port: number;
  };
  output: {
    directory: string;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Config = {
  api: {
    key: ''
  },
  preview: {
    host: '0.0.0.0',
    port: 8080
  },
  server: {
    port: 3001
  },
  output: {
    directory: './webapp-output'
  }
};

/**
 * Load configuration from file
 * @returns The loaded configuration
 */
function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      return JSON.parse(configData) as Config;
    } else if (fs.existsSync(CONFIG_TEMPLATE_PATH)) {
      console.error('Configuration file not found. Please create one by copying the template:');
      console.error('cp config.json.template config.json');
      console.error('Then edit config.json to add your API key and other settings.');
    } else {
      console.error('Neither configuration file nor template found.');
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
  
  // Return default configuration if loading fails
  return DEFAULT_CONFIG;
}

/**
 * Save configuration to file
 * @param config The configuration to save
 */
function saveConfig(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving configuration:', error);
  }
}

// Load the configuration
let config = loadConfig();

/**
 * Get the API key
 * @returns The API key or an empty string if not set
 */
export function getApiKey(): string {
  return config.api.key;
}

/**
 * Set the API key
 * @param key The API key to set
 */
export function setApiKey(key: string): void {
  config.api.key = key;
  saveConfig(config);
}

/**
 * Get the default output directory
 * @returns The default output directory
 */
export function getOutputDirectory(): string {
  return config.output.directory;
}

/**
 * Set the default output directory
 * @param dir The directory to set as default
 */
export function setOutputDirectory(dir: string): void {
  config.output.directory = dir;
  saveConfig(config);
}

/**
 * Get the preview host
 * @returns The preview host
 */
export function getPreviewHost(): string {
  return config.preview.host;
}

/**
 * Set the preview host
 * @param host The host to set
 */
export function setPreviewHost(host: string): void {
  config.preview.host = host;
  saveConfig(config);
}

/**
 * Get the preview port
 * @returns The preview port
 */
export function getPreviewPort(): number {
  return config.preview.port;
}

/**
 * Set the preview port
 * @param port The port to set
 */
export function setPreviewPort(port: number): void {
  config.preview.port = port;
  saveConfig(config);
}

/**
 * Get the server port
 * @returns The server port
 */
export function getServerPort(): number {
  return config.server.port;
}

/**
 * Set the server port
 * @param port The port to set
 */
export function setServerPort(port: number): void {
  config.server.port = port;
  saveConfig(config);
}

/**
 * Get the entire configuration
 * @returns The entire configuration
 */
export function getConfig(): Config {
  return { ...config };
}

/**
 * Set the entire configuration
 * @param newConfig The new configuration
 */
export function setConfig(newConfig: Config): void {
  config = { ...newConfig };
  saveConfig(config);
}

export default config;
