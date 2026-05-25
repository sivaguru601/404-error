import http.server
import socketserver
import webbrowser
import threading
import time
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class EcoWattHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Premium console logger output
        sys.stderr.write(f"\033[90m[EcoWatt Server]\033[0m {format % args}\n")

# Ensure proper JavaScript and CSS MIME types
EcoWattHandler.extensions_map.update({
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
})

def open_browser():
    # Wait a second for the server to spin up
    time.sleep(1.0)
    url = f"http://localhost:{PORT}"
    print(f"\033[92m>> Launching ECOWATT in your browser: {url}\033[0m")
    webbrowser.open(url)

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), EcoWattHandler) as httpd:
        banner = f"""
\033[92m
  ______  ______  ______  _      _  ______  _______  _______ 
 |  ____||  ____|/  __  \\| |    | ||  __  \\|__   __|/__   __|
 | |___  | |     | |  | || |    | || |__| |   | |      | |   
 |  ___| | |     | |  | || | /\\ | ||  __  \\   | |      | |   
 | |____ | |____ | \\__/ / \\ V  V / | |  | |   | |      | |   
 |______||______|\\______/  \\_/\\_/  |_|  |_|   |_|      |_|   
\033[0m
 \033[36m Household Utility & Carbon Footprint Auditor \033[0m
 \033[90m========================================================\033[0m
  \033[93m[+] Development Server active\033[0m
  \033[95m[+] Local Directory:\033[0m {DIRECTORY}
  \033[96m[+] Local URL:\033[0m       http://localhost:{PORT}
 \033[90m========================================================\033[0m
 \033[33mPress Ctrl+C to terminate the server at any time\033[0m
"""
        print(banner)
        
        # Start browser in a background thread
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\033[91m>> ECOWATT server stopped. Have a green day!\033[0m")
            sys.exit(0)

if __name__ == "__main__":
    run_server()
