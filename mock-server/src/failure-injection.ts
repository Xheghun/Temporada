import { ApiError, object } from './app.ts';

export class Failures {
  latencyMs = 0;
  serverErrorRate = 0;
  dropNextResponse = false;
  force413 = false;
  private seed = 1;

  configure(value: unknown): void {
    const body = object(value);
    const allowed = [
      'latencyMs',
      'serverErrorRate',
      'randomSeed',
      'dropNextResponse',
      'force413',
    ];
    for (const key of Object.keys(body))
      if (!allowed.includes(key))
        throw new ApiError(422, 'invalid_failure_control');
    for (const key of ['latencyMs', 'serverErrorRate', 'randomSeed'] as const) {
      const v = body[key];
      if (
        v !== undefined &&
        (typeof v !== 'number' ||
          !Number.isFinite(v) ||
          v < 0 ||
          (key === 'latencyMs' && v > 10000) ||
          (key === 'serverErrorRate' && v > 1) ||
          (key === 'randomSeed' && (!Number.isInteger(v) || v > 0xffffffff)))
      )
        throw new ApiError(422, 'invalid_failure_control');
    }
    for (const key of ['dropNextResponse', 'force413'] as const)
      if (body[key] !== undefined && typeof body[key] !== 'boolean')
        throw new ApiError(422, 'invalid_failure_control');
    // Validate all fields before mutation so an invalid update cannot partially apply.
    if (typeof body.latencyMs === 'number') this.latencyMs = body.latencyMs;
    if (typeof body.serverErrorRate === 'number')
      this.serverErrorRate = body.serverErrorRate;
    if (typeof body.randomSeed === 'number') this.seed = body.randomSeed;
    if (typeof body.dropNextResponse === 'boolean')
      this.dropNextResponse = body.dropNextResponse;
    if (typeof body.force413 === 'boolean') this.force413 = body.force413;
  }
  async beforeRequest(): Promise<void> {
    if (this.latencyMs)
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    if (this.seed / 0x100000000 < this.serverErrorRate)
      throw new ApiError(500, 'injected_failure');
  }
  takeDrop(): boolean {
    const drop = this.dropNextResponse;
    this.dropNextResponse = false;
    return drop;
  }
}
