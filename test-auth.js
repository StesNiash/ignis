const http = require("http");

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 8080,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log("=== Testing Auth API ===\n");

  // 1. Status
  console.log("1. GET /api/auth/status");
  let r = await request("GET", "/api/auth/status");
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);

  // 2. Setup admin
  console.log("\n2. POST /api/auth/setup");
  r = await request("POST", "/api/auth/setup", { username: "admin", password: "admin123" });
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);

  // 3. Status after setup
  console.log("\n3. GET /api/auth/status (after setup)");
  r = await request("GET", "/api/auth/status");
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);

  // 4. Login
  console.log("\n4. POST /api/auth/login");
  r = await request("POST", "/api/auth/login", { username: "admin", password: "admin123" });
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);
  const token = r.body.token;

  if (!token) {
    console.log("\n!!! No token received, stopping tests");
    return;
  }

  // 5. Me
  console.log("\n5. GET /api/auth/me (with token)");
  r = await new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost", port: 8080, path: "/api/auth/me",
      headers: { Authorization: `Bearer ${token}` },
    };
    http.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on("error", reject);
  });
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);

  // 6. Admin: list users
  console.log("\n6. GET /api/admin/users");
  r = await new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost", port: 8080, path: "/api/admin/users",
      headers: { Authorization: `Bearer ${token}` },
    };
    http.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on("error", reject);
  });
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);

  // 7. Protected API without token
  console.log("\n7. GET /api/vault/list (no token)");
  r = await request("GET", "/api/vault/list");
  console.log(`   ${r.status}: ${JSON.stringify(r.body)}`);

  // 8. Protected API with token
  console.log("\n8. GET /api/vault/list (with token)");
  r = await new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost", port: 8080, path: "/api/vault/list",
      headers: { Authorization: `Bearer ${token}` },
    };
    http.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on("error", reject);
  });
  console.log(`   ${r.status}: ${JSON.stringify(Array.isArray(r.body) ? r.body.map(v => v.name) : r.body)}`);

  console.log("\n=== All tests completed ===");
}

main().catch(console.error);
