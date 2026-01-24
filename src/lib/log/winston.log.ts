import { createLogger, transports, format } from "winston";
import chalk from "chalk";

const logger = createLogger({
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
    format.printf(
      (info) =>
        `${chalk.green(info.timestamp)} ${info.level}: ${chalk.blue(info.message)}`
    )
  ),
  transports: [
    new transports.File({
      filename: "./logs/all-logs.log",
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new transports.Console(),
  ],
});

export default logger;

