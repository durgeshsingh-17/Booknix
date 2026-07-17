import winston from 'winston';
import { env } from './env';

export const logger = winston.createLogger({
  level: env.isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    env.isProduction ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  transports: [new winston.transports.Console()],
  silent: env.isTest,
});
