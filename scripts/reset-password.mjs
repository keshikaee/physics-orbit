#!/usr/bin/env node
/**
 * Set a new password for an existing account (admin or student).
 *
 * Runs locally with the Supabase service-role key — never from the browser.
 *
 *   npm run reset-password -- --email someone@example.com
 *   npm run reset-password -- --list        # show account emails and roles
 *
 * The password is typed at a hidden prompt; it is never accepted as an argument
 * (arguments end up in shell history).
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    list: { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

if (args.list) {
  const { data, error } = await supabase.from("profiles").select("email, full_name, role, status").order("role");
  if (error) fail(`Could not list accounts: ${error.message}`);
  console.table(data);
  process.exit(0);
}

if (!args.email) fail("--email is required (or use --list to see accounts).");
const email = args.email.trim().toLowerCase();

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

const { data: profile, error: lookupError } = await supabase
  .from("profiles")
  .select("id, role")
  .eq("email", email)
  .maybeSingle();
if (lookupError) fail(`Could not look up account: ${lookupError.message}`);
if (!profile) fail(`No account found for ${email}. Run with --list to see account emails.`);

const minLength = profile.role === "student" ? 8 : 12;
const password = await promptHidden(`New password for ${email} (${profile.role}): `);
const confirm = await promptHidden("Confirm password: ");
if (password !== confirm) fail("Passwords do not match.");
if (password.length < minLength) fail(`Use at least ${minLength} characters.`);

const { error } = await supabase.auth.admin.updateUserById(profile.id, { password });
if (error) fail(`Could not update password: ${error.message}`);
console.log(`\n✔ Password updated for ${email}. Sign in at /login.\n`);
