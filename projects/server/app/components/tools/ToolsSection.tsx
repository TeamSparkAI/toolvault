import { useState, useEffect, useRef } from 'react';
import { IMcpClientHelper } from '@/lib/services/mcpClientHelper';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { log } from '@/lib/logging/console';

interface ToolsSectionProps {
  serverId: string;
  serverName: string;
  clientHelper: IMcpClientHelper | null;
}

export function ToolsSection({ serverId, serverName, clientHelper }: ToolsSectionProps) {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [showRawResult, setShowRawResult] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);

  useEffect(() => {
    if (clientHelper) {
      setIsLoadingTools(true);
      setLoadingError(null);
      clientHelper.getTools().then(tools => {
        setAvailableTools(tools);
        setIsLoadingTools(false);
      }).catch(err => {
        log.error('Error loading tools:', err);
        setLoadingError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoadingTools(false);
      });
    }
  }, [clientHelper]);

  // Initialize parameters when tool is selected
  useEffect(() => {
    if (selectedTool) {
      const initialParams: Record<string, any> = {};
      if (selectedTool.inputSchema?.properties) {
        Object.entries(selectedTool.inputSchema.properties).forEach(([name, param]: [string, any]) => {
          if (param.default !== undefined) {
            initialParams[name] = param.default;
          }
        });
      }
      setParameterValues(initialParams);
    } else {
      setParameterValues({});
    }
  }, [selectedTool]);

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    setResult(null);
    setExecutionError(null);
  };

  const handleParamChange = (name: string, value: any, isArray: boolean = false, index?: number, fieldName?: string) => {
    setParameterValues(prev => {
      if (isArray) {
        const currentArray = Array.isArray(prev[name]) ? prev[name] as any[] : [];
        if (index !== undefined) {
          // Update existing array element
          const newArray = [...currentArray];
          if (fieldName) {
            // Update a field in an object array element
            newArray[index] = { ...newArray[index], [fieldName]: value };
          } else {
            // Update a primitive array element
            newArray[index] = value;
          }
          return { ...prev, [name]: newArray };
        } else {
          // Add new array element
          return { ...prev, [name]: [...currentArray, value] };
        }
      } else {
        // Handle non-array parameters
        return { ...prev, [name]: value };
      }
    });
  };

  const handleRemoveArrayElement = (name: string, index: number) => {
    setParameterValues(prev => {
      const currentArray = Array.isArray(prev[name]) ? prev[name] as any[] : [];
      return { ...prev, [name]: currentArray.filter((_, i) => i !== index) };
    });
  };

  const renderArrayInput = (name: string, param: any, value: any[] = []) => {
    const itemSchema = param.items;
    const isObjectArray = itemSchema.type === 'object';

    return (
      <div>
        {value.map((item, index) => (
          <div key={index} className="mb-2 p-2 border border-gray-200 rounded">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium">Item {index + 1}</span>
              <button 
                className="text-red-500 hover:text-red-700"
                onClick={() => handleRemoveArrayElement(name, index)}
              >
                Remove
              </button>
            </div>
            {isObjectArray ? (
              <div className="grid gap-2">
                {Object.entries(itemSchema.properties).map(([fieldName, fieldSchema]: [string, any]) => (
                  <div key={fieldName}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {fieldName} ({fieldSchema.type})
                    </label>
                    {fieldSchema.type === 'boolean' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item[fieldName] || false}
                          onChange={(e) => handleParamChange(name, e.target.checked, true, index, fieldName)}
                          className="h-4 w-4"
                        />
                        <span className="text-gray-500">{fieldSchema.description || 'Enable this option'}</span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        value={item[fieldName] || ''}
                        onChange={(e) => handleParamChange(name, e.target.value, true, index, fieldName)}
                        className="w-full px-3 py-2 border rounded"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={item}
                onChange={(e) => handleParamChange(name, e.target.value, true, index)}
                className="w-full px-3 py-2 border rounded"
              />
            )}
          </div>
        ))}
        <button 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            if (isObjectArray) {
              // Create a new object with default values based on the schema
              const newItem = Object.entries(itemSchema.properties).reduce((acc, [fieldName, fieldSchema]: [string, any]) => {
                acc[fieldName] = fieldSchema.type === 'boolean' ? false : '';
                return acc;
              }, {} as Record<string, any>);
              handleParamChange(name, newItem, true);
            } else {
              handleParamChange(name, '', true);
            }
          }}
        >
          Add {isObjectArray ? 'Item' : 'Value'}
        </button>
      </div>
    );
  };

  const handleSubmit = async () => {
    if (!clientHelper || !selectedTool) return;

    setIsLoading(true);
    setExecutionError(null);
    setResult(null);
    setShowRawResult(false);

    try {
      let response;
      if (selectedTool.name === 'ping') {
        response = await clientHelper.ping();
        setResult({ result: response, elapsedTimeMs: response.elapsedTimeMs });
      } else {
        response = await clientHelper.callTool(selectedTool.name, parameterValues);
        setResult(response);
      }
    } catch (err) {
      log.error('Error executing tool:', err);
      setExecutionError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const isTextResult = (result: any): boolean => {
    return Array.isArray(result?.content) && 
           result.content.length === 1 && 
           result.content[0].type === 'text';
  };

  const renderResult = () => {
    if (!result) return null;

    const hasTextResult = isTextResult(result.result);
    const showToggle = hasTextResult;

    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">
            Result ({result.elapsedTimeMs.toFixed(2)}ms)
          </h3>
          {showToggle && (
            <button
              onClick={() => setShowRawResult(!showRawResult)}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              {showRawResult ? 'Show Text' : 'Show Raw'}
            </button>
          )}
        </div>
        {showToggle && !showRawResult ? (
          <div className="bg-black text-green-400 font-mono text-sm p-4 rounded whitespace-pre-wrap">
            {result.result.content[0].text}
          </div>
        ) : (
          <div className="bg-gray-50 rounded">
            <pre className="p-4 overflow-x-auto">
              {JSON.stringify(result.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-4">
      {/* Tools List */}
      <div className="w-96 bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Available Tools</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {isLoadingTools ? (
            <div className="p-4 text-gray-500">Loading tools...</div>
          ) : loadingError ? (
            <div className="p-4 text-red-500">Error loading tools: {loadingError}</div>
          ) : availableTools.length === 0 ? (
            <div className="p-4 text-gray-500">No tools available</div>
          ) : (
            availableTools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => handleToolSelect(tool)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedTool?.name === tool.name ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{tool.name}</div>
                <div className="text-sm text-gray-500 mt-1">{tool.description}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Tool Testing Panel */}
      <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 w-0">
        {executionError ? (
          <div className="p-4 text-red-500">{executionError}</div>
        ) : !selectedTool ? (
          <div className="p-4 text-gray-500">Select a tool to test</div>
        ) : (
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{selectedTool.name}</h3>
            <p className="text-gray-600 mb-6">{selectedTool.description}</p>
            
            <div className="space-y-4">
              {selectedTool.name !== 'ping' && selectedTool.inputSchema?.properties && (
                Object.entries(selectedTool.inputSchema.properties).map(([name, param]: [string, any]) => (
                  <div key={name} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {name}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {param.type === 'array' ? (
                      renderArrayInput(name, param, parameterValues[name] as any[] || [])
                    ) : param.type === 'boolean' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={parameterValues[name] as boolean || false}
                          onChange={(e) => handleParamChange(name, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-gray-500">{param.description || 'Enable this option'}</span>
                      </div>
                    ) : param.enum ? (
                      <select
                        value={parameterValues[name] as string || ''}
                        onChange={(e) => handleParamChange(name, e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                      >
                        <option value="">Select an option</option>
                        {param.enum.map((value: string) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    ) : param.type === 'number' ? (
                      <input
                        type="number"
                        value={parameterValues[name] as number || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? '' : Number(e.target.value);
                          if (value === '' || !isNaN(value)) {
                            handleParamChange(name, value);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded"
                        min={param.minimum}
                        max={param.maximum}
                      />
                    ) : (
                      <input
                        type="text"
                        value={parameterValues[name] as string || ''}
                        onChange={(e) => handleParamChange(name, e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                        placeholder={param.description}
                      />
                    )}
                    {param.description && (
                      <p className="text-sm text-gray-500 mt-1">{param.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Executing...' : 'Execute'}
              </button>
            </div>

            {renderResult()}
          </div>
        )}
      </div>
    </div>
  );
} 