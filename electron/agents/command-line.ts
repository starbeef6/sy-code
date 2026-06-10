/**
 * Tokenize a raw command line into a command + args, honoring single quotes,
 * double quotes and backslash escapes. Used only for custom/unknown agents
 * where the user supplies a free-form command; the three known agents are
 * driven by their dedicated adapters instead.
 */
export function parseCommandLine(commandLine: string): { command: string; args: string[] } {
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let hasActiveToken = false;

  for (const char of commandLine) {
    if (escaping) {
      current += char;
      escaping = false;
      hasActiveToken = true;
      continue;
    }

    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      hasActiveToken = true;
      continue;
    }

    if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === '\\') escaping = true;
      else current += char;
      hasActiveToken = true;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      hasActiveToken = true;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      hasActiveToken = true;
      continue;
    }

    if (/\s/u.test(char)) {
      if (hasActiveToken) {
        tokens.push(current);
        current = '';
        hasActiveToken = false;
      }
      continue;
    }

    current += char;
    hasActiveToken = true;
  }

  if (escaping) current += '\\';
  if (quote) throw new Error('Command contains an unmatched quote');
  if (hasActiveToken) tokens.push(current);
  if (tokens.length === 0 || !tokens[0]?.trim()) {
    throw new Error('Command must not be empty');
  }

  return { command: tokens[0], args: tokens.slice(1) };
}
