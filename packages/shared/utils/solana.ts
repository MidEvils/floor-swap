import {
  createSolanaRpcSubscriptions,
  createDefaultRpcTransport,
  createRpc,
  createJsonRpcApi,
  type RpcResponse,
  type SolanaRpcApi,
} from 'gill';
import type {
  AssetsByOwnerRequest,
  GetAssetResponseList,
  GetTokenAccountsRequest,
  GetTokenAccountsResponse,
  SearchAssetsRequest,
} from 'helius-sdk/types/das';
import type {
  GetAssetBatchRequest,
  GetAssetProofRequest,
  GetAssetProofResponse,
  GetAssetRequest,
  GetAssetResponse,
  GetProgramAccountsV2Request,
  GetProgramAccountsV2Response,
} from 'helius-sdk/types/types';

type DASApi = {
  getAsset(args: GetAssetRequest): GetAssetResponse;
  getAssetBatch(args: GetAssetBatchRequest): GetAssetResponseList;
  getAssetProof(args: GetAssetProofRequest): GetAssetProofResponse;
  getAssetsByOwner(args: AssetsByOwnerRequest): GetAssetResponseList;
  getTokenAccounts(args: GetTokenAccountsRequest): GetTokenAccountsResponse;
  searchAssets(args: SearchAssetsRequest): GetAssetResponseList;
  getProgramAccountsV2(
    args: GetProgramAccountsV2Request
  ): GetProgramAccountsV2Response;
};

const api = createJsonRpcApi<SolanaRpcApi & DASApi>({
  requestTransformer: (r) => {
    switch (r.methodName) {
      case 'getAsset':
      case 'getAssetBatch':
      case 'getAssetProof':
      case 'getAssetsByOwner':
      case 'getTokenAccounts':
      case 'searchAssets':
      case 'getProgramAccountsV2': {
        return {
          ...r,
          // helius methods expect an object,
          // not an array of params
          params: (r.params as unknown[])[0],
        };
      }
    }
    return r;
  },
  responseTransformer: (r: any): RpcResponse<unknown> => {
    return 'result' in r ? r.result : r;
  },
});

export function getRpc(url: string) {
  const transport = createDefaultRpcTransport({
    url,
  });
  return createRpc({ api, transport });
}

export function getSubscriptionsRpc(url: string) {
  return createSolanaRpcSubscriptions(url);
}
