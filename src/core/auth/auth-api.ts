import { z } from 'zod';
import { AuthError } from './auth-service.ts';
import type { AuthApi } from './auth-service.ts';
import type { FetchTransport } from '../api/client.ts';
const responseSchema = z.object({
  token: z.string().min(1),
  workers: z
    .array(
      z.object({ workerId: z.string().min(1), displayName: z.string().min(1) }),
    )
    .min(1),
});
export function createAuthApi(
  baseUrl: string,
  fetcher: FetchTransport = fetch,
): AuthApi {
  async function post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(baseUrl.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 401) throw new AuthError('invalid_otp');
      if (response.status !== 200)
        throw new AuthError(
          response.status === 422 ? 'invalid_phone' : 'network',
        );
      return await response.json();
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('network');
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async requestOtp(phoneNumber) {
      await post('/auth/otp/request', { phoneNumber });
    },
    async verify(phoneNumber, otp) {
      const result = responseSchema.safeParse(
        await post('/auth/otp/verify', { phoneNumber, otp }),
      );
      if (!result.success) throw new AuthError('invalid_response');
      return result.data;
    },
  };
}
