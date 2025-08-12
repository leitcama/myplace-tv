#!/usr/bin/env tsx

import { readFileSync } from "fs"
import { join } from "path"
import { positionAt, resolveVideoId } from "../lib/schedule/now"
import { ChannelConfig } from "../lib/schedule/types"

interface Args {
  file: string
  at?: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const parsed: Args = { file: "" }
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && i + 1 < args.length) {
      parsed.file = args[i + 1]
      i++
    } else if (args[i] === "--at" && i + 1 < args.length) {
      parsed.at = args[i + 1]
      i++
    }
  }
  
  return parsed
}

function main() {
  const args = parseArgs()
  
  if (!args.file) {
    console.error("Usage: npx tsx scripts/chs-now.ts --file <channel.json> [--at <ISO8601>]")
    process.exit(1)
  }
  
  try {
    const configPath = join(process.cwd(), args.file)
    const configData = readFileSync(configPath, "utf8")
    const config: ChannelConfig = JSON.parse(configData)
    
    const now = args.at ? new Date(args.at) : new Date()
    const pos = positionAt(now, config.epochStart, config.items)
    const item = config.items[pos.index]
    
    console.log(JSON.stringify({
      videoId: resolveVideoId(config, item),
      title: item.title,
      index: pos.index,
      offset: pos.offset,
      serverTime: now.toISOString()
    }, null, 2))
    
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
