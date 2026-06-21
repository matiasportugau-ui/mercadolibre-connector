import fs from 'fs';
import path from 'path';
import config from './config.js';

const filePath = config.webhookLogPath;

export function append(event) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n';
  try {
    fs.appendFileSync(filePath, line, 'utf-8');
  } catch (err) {
    console.error(`Failed to write webhook event: ${err.message}`);
    throw err;
  }
}

export function tail(n = 10) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const relevant = lines.slice(-Math.max(1, n));
    return relevant.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (err) {
    console.error(`Failed to read webhook events: ${err.message}`);
    throw err;
  }
}
