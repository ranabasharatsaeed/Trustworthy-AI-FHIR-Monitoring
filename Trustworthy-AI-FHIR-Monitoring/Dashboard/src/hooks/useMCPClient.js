// src/hooks/useMCPClient.js
import { useState, useEffect, useCallback } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const useMCPClient = () => {
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tools, setTools] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeClient = async () => {
      try {
        console.log('🚀 Initializing MCP client...');
        
        const mcpClient = new Client(
          {
            name: 'medical-dashboard',
            version: '1.0.0',
          },
          {
            capabilities: {
              roots: {},
              sampling: {},
            },
          }
        );

        const transport = new StdioClientTransport({
          command: 'python',
          args: ['mcp_medical_server.py'],
        });

        await mcpClient.connect(transport);
        
        // List available tools
        const toolsResponse = await mcpClient.listTools();
        setTools(toolsResponse.tools);
        
        setClient(mcpClient);
        setIsConnected(true);
        setError(null);
        
        console.log('✅ MCP client connected successfully');
        console.log('🛠️ Available tools:', toolsResponse.tools.map(t => t.name));
        
      } catch (err) {
        console.error('❌ MCP client initialization failed:', err);
        setError(err.message);
        setIsConnected(false);
      }
    };

    initializeClient();

    return () => {
      if (client) {
        client.close();
      }
    };
  }, []);

  const callTool = useCallback(async (toolName, arguments) => {
    if (!client || !isConnected) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`🛠️ Calling tool: ${toolName}`, arguments);
      const result = await client.callTool({
        name: toolName,
        arguments,
      });
      
      return result;
    } catch (err) {
      console.error(`❌ Tool ${toolName} call failed:`, err);
      throw err;
    }
  }, [client, isConnected]);

  return {
    client,
    isConnected,
    tools,
    error,
    callTool,
  };
};