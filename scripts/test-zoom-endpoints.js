const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

const config = {
  accountId: "V2OlXAI5Q16QRMAbCbt_rg",
  clientId: "b7Ecoz4STiOp2qraH0D5A",
  clientSecret: "8Px6I3d3l07C2vwa7QvSOKvPzUh5V9wo"
};

async function getToken() {
  const credentials = Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64");
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: config.accountId,
    }),
  });
  const data = await response.json();
  console.log("現在のScopes:", data.scope);
  return data.access_token;
}

async function testEndpoint(token, name, url) {
  console.log("\n=== " + name + " ===");
  console.log("URL:", url);
  try {
    const res = await fetch(url, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    if (data.code) {
      console.log("エラー:", data.code, data.message);
    } else {
      console.log("成功! データ:", JSON.stringify(data, null, 2).slice(0, 500));
      return data;
    }
  } catch (err) {
    console.log("リクエストエラー:", err.message);
  }
  return null;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const token = await getToken();

  // DBからZoomユーザーID取得
  const users = await mongoose.connection.db.collection("users").find({ zoomUserId: { $exists: true, $ne: null } }).limit(5).toArray();
  console.log("\nDBのZoom連携ユーザー数:", users.length);

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = today.toISOString().split("T")[0];

  // 1. アカウント全体の通話ログ (phone:read:list_call_logs:admin が必要)
  await testEndpoint(token, "Account Call History",
    `https://api.zoom.us/v2/phone/call_history?from=${fromStr}&to=${toStr}&page_size=5`);

  // 2. ユーザー個別の通話ログ (phone:read:call_log:admin で可能かも)
  if (users.length > 0) {
    const testUserId = users[0].zoomUserId;
    console.log("\nテストユーザー:", users[0].name, "Zoom ID:", testUserId);

    await testEndpoint(token, "User Call Logs",
      `https://api.zoom.us/v2/phone/users/${testUserId}/call_logs?from=${fromStr}&to=${toStr}&page_size=5`);
  }

  // 3. Phone Users リスト（これは動作確認済み）
  await testEndpoint(token, "Phone Users List",
    "https://api.zoom.us/v2/phone/users?page_size=3");

  // 4. Compliance Recordings
  await testEndpoint(token, "Compliance Recordings",
    `https://api.zoom.us/v2/phone/recordings?from=${fromStr}&to=${toStr}&page_size=5`);

  // 5. Call Queues
  await testEndpoint(token, "Call Queues",
    "https://api.zoom.us/v2/phone/call_queues?page_size=5");

  // 6. Common Areas
  await testEndpoint(token, "Common Area Phones",
    "https://api.zoom.us/v2/phone/common_areas?page_size=5");

  // 7. Phone Numbers
  await testEndpoint(token, "Phone Numbers",
    "https://api.zoom.us/v2/phone/numbers?page_size=5");

  // 8. Sites
  await testEndpoint(token, "Sites",
    "https://api.zoom.us/v2/phone/sites?page_size=5");

  await mongoose.disconnect();
  console.log("\n完了");
}

main().catch(console.error);
