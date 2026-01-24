import morgan from "morgan";
import logger from "./winston.log";

(logger as any).stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

const httpLogger = morgan(
  ":method :url :status :response-time ms - :res[content-length]",
  { stream: (logger as any).stream }
);

export default httpLogger;

