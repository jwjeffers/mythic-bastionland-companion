import http.server
import socketserver
import json
import os

PORT = 8080
STATE_FILE = "campaign_state.json"


class CompanionRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent stale caching during live development between laptop and iPad
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if self.path.endswith((".html", ".js", ".css")) or self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/state"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.exists(STATE_FILE):
                try:
                    with open(STATE_FILE, "r", encoding="utf-8") as f:
                        data = f.read()
                    self.wfile.write(data.encode("utf-8"))
                    return
                except Exception:
                    pass
            self.wfile.write(b"{}")
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/state"):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                parsed = json.loads(body)
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(parsed, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadedHTTPServer(("0.0.0.0", PORT), CompanionRequestHandler) as httpd:
        print(f"Serving Mythic Bastionland Companion on http://0.0.0.0:{PORT}")
        print(f"  - On this laptop: http://localhost:{PORT}")
        print(f"  - On your iPad (same Wi-Fi): http://192.168.1.67:{PORT}")
        httpd.serve_forever()
