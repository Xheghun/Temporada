import assert from 'node:assert/strict';

export async function fixtureRequest(route, body) {
  assert(/^\/__dev\/[a-z-]+$/.test(route), 'Fixture control route required');
  const response = await fetch(`http://127.0.0.1:3101${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(response.status, 200, `Fixture request failed: ${route}`);
  return response.json();
}

export async function waitForObservation(
  description,
  read,
  predicate,
  timeoutMs = 90_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const observation = await read();
    if (predicate(observation)) return observation;
    assert(
      Date.now() < deadline,
      `Observation deadline exceeded: ${description}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
