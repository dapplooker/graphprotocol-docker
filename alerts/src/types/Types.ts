export interface JsonRpcRequest {
    jsonrpc: string;
    method: string;
    params: any[];
    id: number;
}

export interface JsonRpcResponse {
    jsonrpc: string;
    result?: string;
    error?: any;
    id: number;
} 
