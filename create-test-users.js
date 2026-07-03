const http = require("http");

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 8080,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (token) options.headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login as admin
  console.log("Logging in as admin...");
  let r = await api("POST", "/api/auth/login", { username: "admin", password: "admin123" });
  if (r.status !== 200) { console.log("Login failed:", r.body); return; }
  const token = r.body.token;
  console.log("Got token");

  // Create editor user
  console.log("Creating editor user...");
  r = await api("POST", "/api/admin/users", { username: "editor", password: "editor123", role: "editor" }, token);
  console.log(`  ${r.status}: ${JSON.stringify(r.body)}`);

  // Create reader user
  console.log("Creating reader user...");
  r = await api("POST", "/api/admin/users", { username: "reader", password: "reader123", role: "reader" }, token);
  console.log(`  ${r.status}: ${JSON.stringify(r.body)}`);

  // List all users
  console.log("\nUsers:");
  r = await api("GET", "/api/admin/users", null, token);
  console.log(JSON.stringify(r.body, null, 2));

  // Test login as editor
  console.log("\nTesting editor login...");
  r = await api("POST", "/api/auth/login", { username: "editor", password: "editor123" });
  console.log(`  ${r.status}: role=${r.body.user?.role}`);

  // Test login as reader
  console.log("Testing reader login...");
  r = await api("POST", "/api/auth/login", { username: "reader", password: "reader123" });
  console.log(`  ${r.status}: role=${r.body.user?.role}`);

  console.log("\nDone!");
}
main().catch(console.error);
