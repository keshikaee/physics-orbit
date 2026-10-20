#!/usr/bin/env node
/**
 * Create (or promote) an admin account. Admins manage all content and student access.
 *
 * Runs locally with the Supabase service-role key — never from the browser.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *   npm run create-admin -- --email you@example.com --promote   # existing account
 *
 * The password is typed at a hidden prompt; it is never accepted as an argument
 * (arguments end up in shell history).
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    promote: { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
if (!args.email) fail("--email is required.");
if (!args.promote && !args.name) fail("--name is required when creating a new account.");

const email = args.email.trim().toLowerCase();
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function promptHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) fail("Run this in an interactive terminal so the password can be typed securely.");
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let input = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(input);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function findUserId(targetEmail) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", targetEmail)
    .maybeSingle();
  if (error) fail(`Could not look up profile: ${error.message}`);
  return data?.id ?? null;
}

async function setRole(userId) {
  const { error } = await supabase.from("profiles").update({ role: "admin", status: "active" }).eq("id", userId);
  if (error) fail(`Could not set role: ${error.message}`);
}

if (args.promote) {
  const id = await findUserId(email);
  if (!id) fail(`No account found for ${email}. Create it without --promote.`);
  await setRole(id);
  console.log(`\n✔ ${email} is now an admin.\n`);
  process.exit(0);
}

const password = await promptHidden(`Password for ${email}: `);
const confirm = await promptHidden("Confirm password: ");
if (password !== confirm) fail("Passwords do not match.");
if (password.length < 12) fail("Use at least 12 characters for a staff password.");

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: args.name.trim() },
});
if (error) fail(`Could not create user: ${error.message}`);

await setRole(data.user.id);
console.log(`\n✔ Created admin account for ${email}. Sign in at /login.\n`);
