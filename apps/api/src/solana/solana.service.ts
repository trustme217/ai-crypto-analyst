import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

@Injectable()
export class SolanaService {
  private readonly rpcUrl: string;

  constructor(private readonly config: ConfigService) {
    this.rpcUrl =
      this.config.get<string>('SOLANA_RPC_URL') ||
      'https://api.mainnet-beta.solana.com';
  }

  async lookup(address: string) {
    if (!BASE58_RE.test(address)) {
      throw new BadRequestException('Invalid Solana address');
    }

    const [balanceRes, tokenAccounts, signatures] = await Promise.all([
      this.rpc<{ value: number }>('getBalance', [address]),
      this.rpc<{
        value: Array<{
          pubkey: string;
          account: {
            data: {
              parsed: {
                info: {
                  mint: string;
                  tokenAmount: { uiAmount: number | null; decimals: number; amount: string };
                };
              };
            };
          };
        }>;
      }>('getTokenAccountsByOwner', [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]),
      this.rpc<Array<{ signature: string; slot: number; err: unknown; blockTime: number | null }>>(
        'getSignaturesForAddress',
        [address, { limit: 8 }],
      ),
    ]);

    const lamports = Number(balanceRes?.value ?? 0);
    const tokens = (tokenAccounts?.value || [])
      .map((t) => {
        const info = t.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount,
          decimals: info.tokenAmount.decimals,
          rawAmount: info.tokenAmount.amount,
          account: t.pubkey,
        };
      })
      .filter((t) => (t.amount ?? 0) > 0)
      .slice(0, 25);

    return {
      address,
      solBalance: lamports / 1e9,
      lamports,
      tokenCount: tokens.length,
      tokens,
      recentSignatures: (signatures || []).map((s) => ({
        signature: s.signature,
        slot: s.slot,
        err: s.err,
        blockTime: s.blockTime,
      })),
      explorerUrl: `https://solscan.io/account/${address}`,
    };
  }

  /** Recent signatures for continuous wallet ingest. */
  async getSignatures(address: string, limit = 20, before?: string | null) {
    if (!BASE58_RE.test(address)) {
      throw new BadRequestException('Invalid Solana address');
    }
    const opts: { limit: number; before?: string } = { limit: Math.min(50, Math.max(1, limit)) };
    if (before) opts.before = before;
    return this.rpc<
      Array<{ signature: string; slot: number; err: unknown; blockTime: number | null }>
    >('getSignaturesForAddress', [address, opts]);
  }

  /** Full tx for parser (jsonParsed + v0). */
  async getTransaction(signature: string) {
    return this.rpc<Record<string, unknown> | null>('getTransaction', [
      signature,
      {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      },
    ]);
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) {
      throw new HttpException('Solana RPC unavailable', HttpStatus.BAD_GATEWAY);
    }
    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) {
      throw new HttpException(json.error.message || 'Solana RPC error', HttpStatus.BAD_GATEWAY);
    }
    return json.result as T;
  }
}
