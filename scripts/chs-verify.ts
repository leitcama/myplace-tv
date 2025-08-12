#!/usr/bin/env tsx

import fs from "fs";
import path from "path";

function isISODateString(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(value);
}

function main() {
  const file = path.resolve(process.cwd(), "public", "channel.json");
  if (!fs.existsSync(file)) {
    console.error(`Error: ${file} not found`);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, "utf8");
  let json: any;
  try { json = JSON.parse(raw); } catch (e) {
    console.error("Error: channel.json is not valid JSON");
    process.exit(1);
  }

  const errors: string[] = [];

  if (!json.channel || typeof json.channel !== "string") {
    errors.push("channel: required string");
  }
  if (!json.epochStart || !isISODateString(json.epochStart)) {
    errors.push("epochStart: required ISO string");
  }

  if (!Array.isArray(json.items) || json.items.length === 0) {
    errors.push("items: non-empty array required");
  }

  const bumpers = json.bumpers ?? {};
  let totalDuration = 0;

  if (Array.isArray(json.items)) {
    json.items.forEach((it: any, idx: number) => {
      if (!it || typeof it !== "object") {
        errors.push(`items[${idx}]: must be object`);
        return;
      }
      if (it.kind !== "yt" && it.kind !== "bump") {
        errors.push(`items[${idx}].kind: must be 'yt' or 'bump'`);
      }
      if (typeof it.duration !== "number" || it.duration <= 0) {
        errors.push(`items[${idx}].duration: must be number > 0`);
      } else {
        totalDuration += it.duration;
      }
      if (it.kind === "yt") {
        if (!it.id || typeof it.id !== "string") {
          errors.push(`items[${idx}].id: required string for yt`);
        }
      } else if (it.kind === "bump") {
        if (!it.slug || typeof it.slug !== "string") {
          errors.push(`items[${idx}].slug: required string for bump`);
        } else if (!bumpers[it.slug]) {
          errors.push(`items[${idx}].slug: '${it.slug}' not found in bumpers`);
        }
      }
    });
  }

  if (totalDuration <= 0) {
    errors.push("totalDuration cycle must be > 0");
  }

  if (json.rules && typeof json.rules === "object") {
    const r = json.rules;
    if (r.insertBumperEvery != null && (typeof r.insertBumperEvery !== "number" || r.insertBumperEvery <= 0)) {
      errors.push("rules.insertBumperEvery must be a positive number if provided");
    }
    if (r.preferBumperAtWallClock != null && !Array.isArray(r.preferBumperAtWallClock)) {
      errors.push("rules.preferBumperAtWallClock must be an array of strings if provided");
    }
  }

  if (errors.length) {
    console.error("Channel validation failed:\n" + errors.map(e => ` - ${e}`).join("\n"));
    process.exit(1);
  }

  console.log("channel.json OK:", { items: json.items.length, totalDuration });
}

main();
