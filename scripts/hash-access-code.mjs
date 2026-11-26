import { createInterface } from "readline";
import { randomBytes, scryptSync } from "crypto";

const code = await readCode();
if (code.length < 8) {
  console.error("Koden måste vara minst 8 tecken. Inget hash skrevs.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = scryptSync(code, salt, 32, { N: 16384, r: 8, p: 1 });
const hash = `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
console.log("Lägg detta i miljövariabeln ADMIN_ACCESS_CODE_HASH hos värden. Committa det inte.");
console.log(hash);

function readCode() {
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      const chunks = [];
      process.stdin.on("data", (chunk) => chunks.push(chunk));
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "")));
    });
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Åtkomstkod (visas inte i filer, minst 8 tecken): ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
