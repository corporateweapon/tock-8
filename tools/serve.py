"""Local server for Tock-8.

Serves the app folder on this computer only, and lets the page write finished
files (WAV, MIDI, zip, JSON) into the renders/ folder, so a script or a Claude
session gets a real file path back instead of a browser download.

    python tools/serve.py [port]        default port 8766

POST /save/<name> writes the request body to renders/<name>. Only plain file
names with a known extension are accepted, only from this page, and the server
listens on 127.0.0.1 only.
"""
import http.server
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "renders")
NAME = re.compile(r"/save/([A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(?:wav|mid|zip|json))")
MAX_BYTES = 800 * 1024 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _reply(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        match = NAME.fullmatch(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        origin = self.headers.get("Origin")
        port = self.server.server_address[1]
        allowed = (None, "http://localhost:%d" % port, "http://127.0.0.1:%d" % port)
        if not match or origin not in allowed or not 0 < length <= MAX_BYTES:
            self._reply(400, {"error": "refused"})
            return
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, match.group(1))
        with open(path, "wb") as handle:
            remaining = length
            while remaining:
                chunk = self.rfile.read(min(remaining, 1 << 20))
                if not chunk:
                    break
                handle.write(chunk)
                remaining -= len(chunk)
        self._reply(200, {"saved": path, "bytes": length - remaining})

    def log_message(self, fmt, *args):
        if self.command == "POST":
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Tock-8 at http://localhost:%d  (studio: /studio.html, files land in %s)" % (port, OUT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
