// lib/debug-logger.ts
interface DebugLog {
  function: string;
  message: string;
  data?: any;
  timestamp: string;
}

const debugLogs: DebugLog[] = [];
const MAX_LOGS = 100;

export function debugLog(functionName: string, message: string, data?: any) {
  const log: DebugLog = {
    function: functionName,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  
  console.log(`🔍 [${functionName}] ${message}`, data || '');
  
  debugLogs.unshift(log);
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.pop();
  }
}

export function getDebugLogs() {
  return debugLogs;
}

export function clearDebugLogs() {
  debugLogs.length = 0;
}