/** ************Response Class Interface Start************* */
export interface SuccessResponse {
    success: boolean;
    data: any;
}
export interface ErrorResponse {
    success: boolean;
    errorData: Record<string, string>;
    debugOptions: any;
}
