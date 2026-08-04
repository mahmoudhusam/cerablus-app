/**
 * One-off helper: turn a password into the bcrypt hash that goes in
 * ADMIN_PASSWORD_HASH.
 *
 * NOTHING runs this automatically — not install, not build, not the seed. It
 * exists so the owner's password is chosen and hashed on their own machine and
 * only the hash is ever stored.
 *
 *   npm run hash-password
 *
 * It prompts with the input hidden, asks twice, and prints only the hash. The
 * password is never written to disk, never logged, and never sent anywhere.
 *
 * You can also pipe one in for scripted setup:
 *
 *   printf '%s' 'the password' | npm run hash-password --silent
 *
 * Passing the password as an argument is deliberately NOT supported: it would
 * land in shell history and in the process list, where other users can read it.
 */
import { stdin, stdout } from "node:process";

import { hash } from "bcryptjs";

/**
 * bcrypt work factor.
 *
 * 12 is the current recommendation, and it is what protects the password if the
 * hash itself ever leaks — an offline attacker's cost scales with this number,
 * not with how fast our own code runs.
 *
 * Note the local cost: bcryptjs is pure JavaScript (chosen so nothing has to
 * compile natively on Vercel), which makes a cost-12 compare take ~1.7s rather
 * than the ~250ms a native build would. That is the login's latency — fine for
 * one owner signing in once a day, and it is deliberately not traded away.
 */
const COST = 12;

const MIN_LENGTH = 12;

/**
 * Read a line from the terminal without echoing what is typed.
 *
 * Raw mode and a manual read loop rather than readline: readline has no
 * supported way to suppress its echo, and the usual workaround reaches into an
 * undocumented internal.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    const finish = (settle: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      settle();
    };

    function onData(chunk: string) {
      for (const char of chunk) {
        switch (char) {
          case "\r":
          case "\n":
            finish(() => resolve(value));
            return;
          case "\u0003": // Ctrl-C
            finish(() => reject(new Error("cancelled")));
            return;
          case "\u007F": // Backspace
          case "\b":
            value = value.slice(0, -1);
            break;
          default:
            // Ignore other control characters; take everything else verbatim.
            if (char >= " ") value += char;
        }
      }
    }

    stdin.on("data", onData);
  });
}

/** Read the whole of stdin, for the piped (non-interactive) case. */
async function readPiped(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
  let password: string;

  if (stdin.isTTY) {
    password = await promptHidden("New admin password: ");
    const again = await promptHidden("Repeat it: ");
    if (password !== again) {
      console.error("\nThe two entries do not match. Nothing was written.");
      process.exit(1);
    }
  } else {
    password = await readPiped();
  }

  if (password.length < MIN_LENGTH) {
    console.error(
      `\nToo short — use at least ${MIN_LENGTH} characters. This is the only credential guarding the menu.`,
    );
    process.exit(1);
  }

  const digest = await hash(password, COST);

  /* TWO forms, because they are consumed by two different parsers.
     ------------------------------------------------------------------------
     Next.js runs every .env value through dotenv-expand, which reads `$` as the
     start of a variable reference — and a bcrypt hash is `$2b$12$…`. Left as-is
     it is silently truncated into a wrong string, and quoting does NOT prevent
     it; only a backslash before each `$` does. That failure looks exactly like
     a wrong password, so it is worth two lines of output to avoid.

     A value typed into Vercel's dashboard never goes through dotenv, so there
     it must be the plain hash. */
  console.log("\n1. For .env.local — $ escaped so Next.js does not expand it:\n");
  console.log(`ADMIN_PASSWORD_HASH="${digest.replace(/\$/g, "\\$")}"`);
  console.log("\n2. For the Vercel dashboard (or any host that takes the value verbatim):\n");
  console.log(digest);
  console.log("\nDo not commit either one. Do not paste the password anywhere.\n");
}

main().catch((error) => {
  // Print the message only — an error object could carry the input around with it.
  console.error("Failed to hash the password:", error instanceof Error ? error.message : error);
  process.exit(1);
});
