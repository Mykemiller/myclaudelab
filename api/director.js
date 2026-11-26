// The Lab Director's clips live privately in HeyGen. Their play links expire after about a week.
// This function hands a family member a fresh link on demand, so clips never go stale.
// It only runs behind the family password (middleware.js guards every path),
// only for clip ids listed in content/director.json, and only when a parent has set
// the HEYGEN_API_KEY environment variable in Vercel. Without the key it answers 404
// and the page shows the Director's words as a transcript instead. Play links are never
// stored in the repository, because the repository is public.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Unknown clip", { status: 400 });

  const key = process.env.HEYGEN_API_KEY;
  if (!key) return new Response("Not configured", { status: 404 });

  // Only clips the workshop lists. Forward the family cookie so the request passes the gate.
  const listed = await fetch(new URL("/content/director.json", url), {
    headers: { cookie: req.headers.get("cookie") || "" },
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const all = listed ? [...(listed.current || []), ...(listed.archive || [])] : [];
  if (!all.some((c) => c.heygenId === id)) return new Response("Unknown clip", { status: 404 });

  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${id}`, {
    headers: { "X-Api-Key": key, accept: "application/json" },
  }).catch(() => null);
  const body = res && res.ok ? await res.json().catch(() => null) : null;
  const fresh = body && body.data && body.data.video_url;
  if (!fresh || !/^https:\/\/[a-z0-9.-]+\.heygen\.ai\//.test(fresh)) {
    return new Response("Clip unavailable", { status: 502 });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: fresh, "Cache-Control": "private, max-age=1800" },
  });
}
