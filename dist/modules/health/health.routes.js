import { Router } from 'express';
import { ApiResponse } from '../../common/response/api-response.js';
const router = Router();
router.get('/', (_req, res) => {
    ApiResponse.success(res, 'ScanPro API is running healthy', {
        status: 'UP',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
export const healthRoutes = router;
//# sourceMappingURL=health.routes.js.map