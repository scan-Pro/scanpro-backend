export interface GetPresignedUrlDto {
    fileName: string;
    fileType: string;
    folder?: string;
}
export interface PresignedUrlResult {
    uploadUrl: string;
    fileUrl: string;
    key: string;
    expiresIn: number;
}
