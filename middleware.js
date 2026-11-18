// The Curiosity Workshop: family password gate.
// Runs on Vercel before every request. Anyone without the family cookie sees the sign-in page.
// The password lives in the FAMILY_PASSWORD environment variable, never in this file.

export const config = { matcher: "/((?!_vercel).*)" };

const COOKIE = "cw_family";
const NINETY_DAYS = 60 * 60 * 24 * 90;
const enc = new TextEncoder();

// The cookie holds a fingerprint of the password, not the password itself.
// Changing FAMILY_PASSWORD changes the fingerprint, which signs everyone out.
async function fingerprint(pw) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode("curiosity-workshop|" + pw));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function readCookie(req, name) {
  const part = (req.headers.get("cookie") || "").split(/;\s*/).find((p) => p.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function safeBack(v) {
  const s = String(v || "/");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/__") ? s : "/";
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const next = () => new Response(null, { headers: { "x-middleware-next": "1" } });

function page(message, status, withForm) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>The Curiosity Workshop</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔧</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600&family=Patrick+Hand&family=Saira+Stencil+One&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{font-family:"Bricolage Grotesque","Avenir Next","Segoe UI",system-ui,sans-serif;color:#F3EDE0;background:#0e0e10;display:grid;place-items:center;padding:20px;
  background-image:linear-gradient(rgba(10,10,12,.55),rgba(10,10,12,.85)),url(/room.webp);background-size:cover;background-position:center}
.card{width:min(420px,100%);background:rgba(24,24,28,.86);backdrop-filter:blur(8px);border-radius:14px;padding:26px;box-shadow:0 30px 60px rgba(0,0,0,.6)}
h1{font-family:"Saira Stencil One",Impact,sans-serif;font-weight:400;letter-spacing:.05em;text-transform:uppercase;margin:0 0 6px;font-size:1.9rem}
p{margin:0 0 16px;color:#d7cfbf}
.msg{font-family:"Patrick Hand",cursive;font-size:1.2rem;color:#FFE7A8}
label{display:block;font-weight:600;margin-bottom:6px}
input{width:100%;font:inherit;padding:11px 12px;border-radius:10px;border:2px solid #4a4a52;background:#f8f3e7;color:#24242a}
input:focus{outline:3px solid #F2B632;outline-offset:2px}
button{margin-top:14px;width:100%;font:inherit;font-weight:600;padding:12px;border:0;border-radius:10px;background:#F2B632;color:#1e1e22;cursor:pointer}
</style></head><body>
<main class="card">
  <h1>🔧 The Curiosity Workshop</h1>
  <p>Our family’s makerspace for learning Claude.</p>
  ${message ? `<p class="msg" role="alert">${esc(message)}</p>` : ""}
  ${withForm ? `<form method="post" action="/__login">
    <label for="pw">Family password</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
    <input type="hidden" name="back" id="back" value="/">
    <button type="submit">Come on in</button>
  </form>
  <script>document.getElementById("back").value = location.pathname + location.hash;</script>` : ""}
</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const password = process.env.FAMILY_PASSWORD;

  // The sign-in page's background photo is the only thing visible without the password.
  if (url.pathname === "/room.webp" || url.pathname === "/img/room.webp") return next();

  // Fail closed: no password set means nobody gets in.
  if (!password) return page("The workshop is locked until a parent sets the family password.", 503, false);
  const want = await fingerprint(password);

  if (url.pathname === "/__logout") {
    return new Response(null, {
      status: 303,
      headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (url.pathname === "/__login" && req.method === "POST") {
    const form = await req.formData();
    const back = safeBack(form.get("back"));
    if (same(await fingerprint(String(form.get("password") || "")), want)) {
      return new Response(null, {
        status: 303,
        headers: { Location: back, "Set-Cookie": `${COOKIE}=${want}; Path=/; Max-Age=${NINETY_DAYS}; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return page("That’s not the family password. Try again.", 401, true);
  }

  if (same(readCookie(req, COOKIE), want)) return next();
  return page("", 401, true);
}