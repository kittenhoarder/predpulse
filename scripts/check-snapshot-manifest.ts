import { get, head } from "@vercel/blob";

// Read-only diagnosis. No credentials, URLs, ETags or snapshot bodies are logged.
async function main() {
  const path = "predpulse/latest.json";
  const [delivered, identity, metadata] = await Promise.all([
    get(path, { access: "private", useCache: false }),
    get(path, { access: "private", useCache: false, headers: { "Accept-Encoding": "identity" } }),
    head(path),
  ]);
  if (!delivered || !identity || delivered.statusCode !== 200 || identity.statusCode !== 200) throw new Error("Manifest diagnostic read failed");
  const normal = await new Response(delivered.stream).json(), plain = await new Response(identity.stream).json();
  console.info("[publisher] manifest ETag diagnosis", {
    sameManifest: JSON.stringify(normal) === JSON.stringify(plain),
    deliveredTagMatchesStorage: delivered.blob.etag === metadata.etag,
    identityTagMatchesStorage: identity.blob.etag === metadata.etag,
    deliveredTagIsWeak: delivered.blob.etag.startsWith("W/"),
    identityTagIsWeak: identity.blob.etag.startsWith("W/"),
    contentEncoding: delivered.headers.get("content-encoding"),
  });
}
main().catch(error => { console.error("[publisher] manifest diagnosis failed", error); process.exitCode = 1; });
