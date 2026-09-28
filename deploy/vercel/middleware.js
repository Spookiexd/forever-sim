// Vercel Routing Middleware: HTTP Basic Auth for every path of the static site.
// Credentials come from the SIM_USER / SIM_PASSWORD environment variables (set with `vercel env`).
// If either variable is missing the site stays locked (fail closed) instead of going public.

export const config = {
	// Every path, including static assets and lib.wasm.gz.
	matcher: '/:path*',
};

const REALM = 'Forever sim';

function unauthorized(message) {
	return new Response(message, {
		status: 401,
		headers: {
			'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
}

// Constant-time comparison so response timing does not leak how much of the password matched.
function safeEqual(a, b) {
	const enc = new TextEncoder();
	const x = enc.encode(a);
	const y = enc.encode(b);
	let diff = x.length ^ y.length;
	const n = Math.max(x.length, y.length);
	for (let i = 0; i < n; i++) diff |= (x[i % (x.length || 1)] ?? 0) ^ (y[i % (y.length || 1)] ?? 0);
	return diff === 0;
}

export default function middleware(request) {
	const user = process.env.SIM_USER;
	const pass = process.env.SIM_PASSWORD;
	if (!user || !pass) return unauthorized('Site locked: credentials are not configured.');

	const header = request.headers.get('authorization') || '';
	const [scheme, encoded] = header.split(' ');
	if (scheme !== 'Basic' || !encoded) return unauthorized('Authentication required.');

	let decoded;
	try {
		decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
	} catch {
		return unauthorized('Authentication required.');
	}
	const sep = decoded.indexOf(':');
	const okUser = safeEqual(sep < 0 ? decoded : decoded.slice(0, sep), user);
	const okPass = safeEqual(sep < 0 ? '' : decoded.slice(sep + 1), pass);
	if (!(okUser && okPass)) return unauthorized('Authentication required.');

	// The site lives under /forever/ (hard-coded asset paths); send the bare root there.
	const url = new URL(request.url);
	if (url.pathname === '/') return Response.redirect(new URL('/forever/', url), 307);

	// Same as next() from @vercel/functions: continue to the static file.
	return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
