import { defaultLabel, linkHost, serviceFor } from "@/lib/links";

/**
 * A link is recognised by its host, so the icon has to survive share URLs,
 * tracking parameters and subdomains — and must not be fooled by a lookalike
 * domain, which would put someone else's brand on a stranger's page.
 */
const cases: Array<[string, string, string]> = [
  ["https://www.strava.com/activities/123456", "strava", "Strava"],
  ["https://strava.app.link/abcdef", "strava", "Strava"],
  ["https://www.instagram.com/p/Cabc123/?igsh=xyz", "instagram", "Instagram"],
  ["https://youtu.be/dQw4w9WgXcQ", "youtube", "YouTube"],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "youtube", "YouTube"],
  ["https://m.youtube.com/watch?v=x", "youtube", "YouTube"],
  ["https://www.tiktok.com/@user/video/123", "tiktok", "TikTok"],
  ["https://vm.tiktok.com/ZMabc/", "tiktok", "TikTok"],
  ["https://www.fidal.it/risultati/123", "generic", "fidal.it"],
  // Lookalikes must not borrow the brand.
  ["https://notstrava.com/activities/1", "generic", "notstrava.com"],
  ["https://strava.com.evil.example/x", "generic", "strava.com.evil.example"],
  // Not linkable at all.
  ["javascript:alert(1)", "generic", "javascript:alert(1)"],
  ["not a url", "generic", "not a url"],
];

let failures = 0;
for (const [url, service, label] of cases) {
  const gotService = serviceFor(url);
  const gotLabel = defaultLabel(url);
  const ok = gotService === service && gotLabel === label;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${gotService.padEnd(10)} ${gotLabel.padEnd(24)} ${url}` +
      (ok ? "" : `  ← expected ${service} / ${label}`),
  );
}

// Only http(s) may reach an href.
for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"]) {
  const ok = linkHost(bad) === null;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} refuses ${bad}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
