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
  console.log("=== トークン情報 ===");
  console.log("Scopes:", data.scope);
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
      console.log("❌ エラー:", data.code, data.message);
      return null;
    } else {
      console.log("✅ 成功!");
      console.log("データ:", JSON.stringify(data, null, 2).slice(0, 800));
      return data;
    }
  } catch (err) {
    console.log("❌ リクエストエラー:", err.message);
    return null;
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

  console.log("\n期間:", fromStr, "〜", toStr);

  // DBからZoomユーザーID取得
  const users = await mongoose.connection.db.collection("users")
    .find({ zoomUserId: { $exists: true, $ne: null } })
    .limit(3)
    .toArray();

  // 1. 通話履歴取得（全アカウント）- phone:read:admin
  const callHistory = await testEndpoint(token, "通話履歴（全アカウント）",
    `https://api.zoom.us/v2/phone/call_history?from=${fromStr}&to=${toStr}&page_size=5`);

  // 2. ユーザー別通話ログ - phone:read:admin
  if (users.length > 0) {
    const userId = users[0].zoomUserId;
    console.log("\nテストユーザー:", users[0].name, "(", userId, ")");

    await testEndpoint(token, "ユーザー別通話ログ",
      `https://api.zoom.us/v2/phone/users/${userId}/call_logs?from=${fromStr}&to=${toStr}&page_size=5`);
  }

  // 3. 録音一覧取得 - phone_recording:read:admin
  await testEndpoint(token, "録音一覧",
    `https://api.zoom.us/v2/phone/recordings?from=${fromStr}&to=${toStr}&page_size=5`);

  // 4. Zoom Phoneユーザー一覧 - phone:read:list_users:admin (確認済み)
  await testEndpoint(token, "Zoom Phoneユーザー一覧",
    "https://api.zoom.us/v2/phone/users?page_size=3");

  await mongoose.disconnect();
  console.log("\n完了");
}

main().catch(console.error);
