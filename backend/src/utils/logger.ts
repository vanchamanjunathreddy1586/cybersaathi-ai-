type LogDetails = Record<string, boolean | number | string>;

function writeLog(
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  details?: LogDetails,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(details ? { details } : {}),
  };

  const output = JSON.stringify(entry);

  if (level === 'ERROR') {
    console.error(output);
    return;
  }

  if (level === 'WARN') {
    console.warn(output);
    return;
  }

  console.info(output);
}

export const logger = {
  info: (message: string, details?: LogDetails) =>
    writeLog('INFO', message, details),
  warn: (message: string, details?: LogDetails) =>
    writeLog('WARN', message, details),
  error: (message: string, details?: LogDetails) =>
    writeLog('ERROR', message, details),
};
