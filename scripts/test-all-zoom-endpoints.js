const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

const config = {
  accountId: process.env.ZOOM_ACCOUNT_ID,
  clientId: process.env.ZOOM_CLIENT_ID,
  clientSecret: process.env.ZOOM_CLIENT_SECRET
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
  try {
    const res = await fetch(url, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    if (data.code) {
      return { name, url, success: false, error: data.message };
    } else {
      return { name, url, success: true, data };
    }
  } catch (err) {
    return { name, url, success: false, error: err.message };
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const token = await getToken();

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = today.toISOString().split("T")[0];

  // DBからZoomユーザーID取得
  const user = await mongoose.connection.db.collection("users")
    .findOne({ zoomUserId: { $exists: true, $ne: null } });
  const userId = user?.zoomUserId || "me";

  // テストするエンドポイント一覧
  const endpoints = [
    // Phone Users関連
    ["Phone Users List", "https://api.zoom.us/v2/phone/users?page_size=3"],
    ["Phone User Detail", `https://api.zoom.us/v2/phone/users/${userId}`],
    ["Phone User Settings", `https://api.zoom.us/v2/phone/users/${userId}/settings`],
    ["Phone User Call Logs", `https://api.zoom.us/v2/phone/users/${userId}/call_logs?from=${fromStr}&to=${toStr}`],
    ["Phone User Recordings", `https://api.zoom.us/v2/phone/users/${userId}/recordings?from=${fromStr}&to=${toStr}`],
    ["Phone User Voicemails", `https://api.zoom.us/v2/phone/users/${userId}/voice_mails`],

    // Account全体
    ["Account Call History", `https://api.zoom.us/v2/phone/call_history?from=${fromStr}&to=${toStr}`],
    ["Account Recordings", `https://api.zoom.us/v2/phone/recordings?from=${fromStr}&to=${toStr}`],

    // Phone設定関連
    ["Phone Sites", "https://api.zoom.us/v2/phone/sites"],
    ["Phone Numbers", "https://api.zoom.us/v2/phone/numbers"],
    ["Call Queues", "https://api.zoom.us/v2/phone/call_queues"],
    ["Auto Receptionists", "https://api.zoom.us/v2/phone/auto_receptionists"],
    ["Common Areas", "https://api.zoom.us/v2/phone/common_areas"],
    ["Shared Line Groups", "https://api.zoom.us/v2/phone/shared_line_groups"],
    ["Call Handling Templates", "https://api.zoom.us/v2/phone/call_handling/templates"],

    // SMS関連
    ["SMS Sessions", `https://api.zoom.us/v2/phone/users/${userId}/sms/sessions`],

    // Phone Account
    ["Phone Account", "https://api.zoom.us/v2/phone"],
    ["Phone Account Settings", "https://api.zoom.us/v2/phone/settings"],
    ["Phone Account Plan", "https://api.zoom.us/v2/phone/account/plan"],

    // その他
    ["Blocked List", "https://api.zoom.us/v2/phone/blocked_list"],
    ["External Contacts", "https://api.zoom.us/v2/phone/external_contacts"],
    ["Call Monitoring Groups", "https://api.zoom.us/v2/phone/call_monitoring/groups"],
  ];

  console.log("\n=== Zoom Phone API エンドポイントテスト ===\n");

  const results = { success: [], failed: [] };

  for (const [name, url] of endpoints) {
    const result = await testEndpoint(token, name, url);
    if (result.success) {
      results.success.push(result);
      console.log(`✅ ${name}`);
    } else {
      results.failed.push(result);
      console.log(`❌ ${name}: ${result.error?.slice(0, 60)}`);
    }
  }

  console.log("\n=== 成功したエンドポイント ===");
  for (const r of results.success) {
    console.log(`\n--- ${r.name} ---`);
    console.log("URL:", r.url);
    const preview = JSON.stringify(r.data, null, 2);
    console.log("データ:", preview.slice(0, 600) + (preview.length > 600 ? "..." : ""));
  }

  console.log("\n\n=== サマリー ===");
  console.log(`成功: ${results.success.length} / ${endpoints.length}`);
  console.log(`失敗: ${results.failed.length} / ${endpoints.length}`);

  await mongoose.disconnect();
}

main().catch(console.error);
