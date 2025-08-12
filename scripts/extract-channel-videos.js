#!/usr/bin/env node

console.log(`
=== My Place Ohio Channel Video Extractor ===

To extract video IDs from your channel:

1. Go to: https://www.youtube.com/@myplaceohio/videos
2. Open browser dev tools (F12)
3. Go to Console tab
4. Copy and paste this code:

// Extract video information
const videos = [];
const videoElements = document.querySelectorAll("a[href*=\"/watch?v=\"]");

videoElements.forEach(link => {
  const href = link.getAttribute("href");
  const videoId = href.match(/watch\?v=([^&]+)/)?.[1];
  const title = link.querySelector("h3")?.textContent?.trim();
  
  if (videoId && title && !videos.find(v => v.id === videoId)) {
    videos.push({
      id: videoId,
      title: title,
      url: \`https://www.youtube.com/watch?v=\${videoId}\`
    });
  }
});

// Output in channel.json format
console.log("\n=== CHANNEL.JSON FORMAT ===");
console.log(JSON.stringify({
  channel: "My Place Ohio",
  epochStart: new Date().toISOString(),
  items: videos.slice(0, 10).map(v => ({
    kind: "direct",
    id: v.id,
    title: v.title,
    duration: 300 // You will need to get actual durations
  })),
  bumpers: {},
  rules: {}
}, null, 2));

console.log("\n=== VIDEO LIST ===");
videos.slice(0, 10).forEach((v, i) => {
  console.log(\`\${i + 1}. \${v.title}\`);
  console.log(\`   ID: \${v.id}\`);
  console.log(\`   URL: \${v.url}\`);
  console.log("");
});

5. Copy the output and update public/myplace-channel.json
6. Get actual video durations (you can use YouTube API or manually check)

=== ALTERNATIVE: Manual Method ===

1. Go to each video on your channel
2. Copy the video ID from the URL (after watch?v=)
3. Note the title and approximate duration
4. Update public/myplace-channel.json manually

Example video IDs to replace:
- VIDEO_ID_1 → actual video ID from your channel
- VIDEO_ID_2 → actual video ID from your channel  
- VIDEO_ID_3 → actual video ID from your channel

=== NEXT STEPS ===

1. Update public/myplace-channel.json with real video IDs
2. Add actual video durations
3. Test at http://localhost:3000/myplace
4. Deploy to production

`);
