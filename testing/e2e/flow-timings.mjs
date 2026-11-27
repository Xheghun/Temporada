import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const controlIds = ['nav-job', 'nav-home', 'nav-documents', 'language-toggle'];
export async function readTapTimings(directory) {
  const commands = [];
  const loggedTaps = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (entry.name === 'commands.json') {
        for (const command of JSON.parse(await readFile(filename, 'utf8'))) {
          const id = command.command?.tapOnElement?.selector?.idRegex;
          if (controlIds.includes(id))
            commands.push({
              id,
              timestamp: command.metadata.timestamp,
              durationMs: command.metadata.duration,
              status: command.metadata.status,
            });
        }
      } else if (entry.name === 'maestro.log') {
        for (const line of (await readFile(filename, 'utf8')).split('\n')) {
          const match =
            /^(\d{2}:\d{2}:\d{2}\.\d{3}).*Tapping on element:.*?resource-id=([^,}\s]+)/.exec(
              line,
            );
          if (match && controlIds.includes(match[2]))
            loggedTaps.push({ time: match[1], id: match[2] });
        }
      }
    }
  }
  await visit(directory);
  // Driver processes run with TZ=UTC. Match the actual tap log within its command interval.
  return commands.map((command) => {
    const day = new Date(command.timestamp).toISOString().slice(0, 10);
    const actualTapAt = loggedTaps
      .filter((tap) => tap.id === command.id)
      .flatMap((tap) => {
        const timestamp = Date.parse(`${day}T${tap.time}Z`);
        return [timestamp - 86_400_000, timestamp, timestamp + 86_400_000];
      })
      .find(
        (timestamp) =>
          timestamp >= command.timestamp &&
          timestamp <= command.timestamp + command.durationMs,
      );
    return { ...command, actualTapAt: actualTapAt ?? null };
  });
}
