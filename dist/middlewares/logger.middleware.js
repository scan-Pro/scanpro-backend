// ANSI escape codes for terminal color formatting
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
};
// Mask sensitive fields in logs (passwords, tokens)
const sanitizePayload = (obj) => {
    if (!obj || typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj))
        return obj.map(sanitizePayload);
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (/password|token|secret|authorization/i.test(key)) {
            sanitized[key] = '********';
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizePayload(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
const getStatusColor = (status) => {
    if (status >= 500)
        return colors.red;
    if (status >= 400)
        return colors.yellow;
    if (status >= 300)
        return colors.cyan;
    if (status >= 200)
        return colors.green;
    return colors.reset;
};
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toLocaleTimeString();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.socket.remoteAddress || '-';
    // 1. Log Incoming Request
    console.log(colors.dim + '─'.repeat(60) + colors.reset);
    console.log(`${colors.gray}[${timestamp}]${colors.reset} ` +
        `${colors.cyan}📥 INCOMING${colors.reset} ` +
        `${colors.bold}${method}${colors.reset} ${url} ` +
        `${colors.dim}(from ${ip})${colors.reset}`);
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        console.log(`   ${colors.dim}Request Body:${colors.reset} ${JSON.stringify(sanitizePayload(req.body), null, 2)}`);
    }
    if (req.query && Object.keys(req.query).length > 0) {
        console.log(`   ${colors.dim}Query Params:${colors.reset} ${JSON.stringify(req.query, null, 2)}`);
    }
    // 2. Intercept response body
    let responseBody = undefined;
    const originalSend = res.send;
    res.send = function (body) {
        try {
            if (typeof body === 'string') {
                responseBody = JSON.parse(body);
            }
            else {
                responseBody = body;
            }
        }
        catch {
            responseBody = body;
        }
        return originalSend.call(this, body);
    };
    // 3. Log Completed Response on finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const statusColor = getStatusColor(statusCode);
        console.log(`${colors.gray}[${new Date().toLocaleTimeString()}]${colors.reset} ` +
            `${statusColor}📤 COMPLETED${colors.reset} ` +
            `${colors.bold}${method}${colors.reset} ${url} -> ` +
            `${statusColor}${colors.bold}${statusCode}${colors.reset} ` +
            `${colors.dim}(${duration}ms)${colors.reset}`);
        if (responseBody !== undefined) {
            console.log(`   ${colors.dim}Response Body:${colors.reset} ${JSON.stringify(sanitizePayload(responseBody), null, 2)}`);
        }
        console.log(colors.dim + '─'.repeat(60) + colors.reset);
    });
    next();
};
//# sourceMappingURL=logger.middleware.js.map