import { FoldersService } from '../service/folders.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
export class FoldersController {
    foldersService;
    constructor(foldersService = new FoldersService()) {
        this.foldersService = foldersService;
    }
    createFolder = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const folder = await this.foldersService.createFolder(userId, req.body);
            ApiResponse.created(res, 'Folder created successfully', folder);
        }
        catch (error) {
            next(error);
        }
    };
    getFolders = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const folders = await this.foldersService.getFolders(userId);
            ApiResponse.success(res, 'Folders fetched successfully', folders);
        }
        catch (error) {
            next(error);
        }
    };
    getFolderById = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            const folder = await this.foldersService.getFolderById(id, userId);
            ApiResponse.success(res, 'Folder fetched successfully', folder);
        }
        catch (error) {
            next(error);
        }
    };
    updateFolder = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            const folder = await this.foldersService.updateFolder(id, userId, req.body);
            ApiResponse.success(res, 'Folder updated successfully', folder);
        }
        catch (error) {
            next(error);
        }
    };
    deleteFolder = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            await this.foldersService.deleteFolder(id, userId);
            ApiResponse.success(res, 'Folder deleted successfully');
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=folders.controller.js.map