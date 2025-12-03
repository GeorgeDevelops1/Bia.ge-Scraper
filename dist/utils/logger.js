"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function log(level, message, meta) {
    const timestamp = new Date().toISOString();
    if (meta !== undefined) {
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
    }
    else {
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
}
exports.logger = {
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta)
};
