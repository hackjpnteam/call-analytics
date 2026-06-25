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

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const token = await getToken();

  const tenant = await mongoose.connection.db.collection("tenants").findOne({});
  const tenantId = tenant._id;

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = today.toISOString().split("T")[0];

  console.log("\n=== 通話ログ取得 ===");
  console.log("期間:", fromStr, "〜", toStr);

  const callRes = await fetch(
    "https://api.zoom.us/v2/phone/call_history?from=" + fromStr + "&to=" + toStr + "&page_size=100",
    { headers: { "Authorization": "Bearer " + token } }
  );
  const callData = await callRes.json();

  if (callData.code) {
    console.log("エラー:", callData.message);
  } else {
    console.log("取得件数:", callData.call_logs?.length || 0);
    console.log("総件数:", callData.total_records || 0);

    if (callData.call_logs && callData.call_logs.length > 0) {
      const users = await mongoose.connection.db.collection("users").find({ tenantId }).toArray();
      const userIdMap = new Map(users.map(u => [u.zoomUserId, u._id]));
      const defaultUserId = users[0]?._id;

      let savedCount = 0;
      for (const log of callData.call_logs) {
        let userId = userIdMap.get(log.user_id) || defaultUserId;
        if (!userId) continue;

        let result = "connected";
        const r = (log.result || "").toLowerCase();

        // duration > 0 の場合は接続済み（実際に通話があった）
        if (log.duration > 0) {
          result = "connected";
        } else if (r.includes("no_answer") || r.includes("no answer") || r.includes("missed")) {
          result = "no_answer";
        } else if (r.includes("busy")) {
          result = "busy";
        } else if (r.includes("voicemail")) {
          result = "voicemail";
        } else if (r.includes("cancel")) {
          result = "cancelled";
        } else if (r.includes("fail") || log.duration === 0) {
          result = "no_answer";
        }

        const callLog = {
          tenantId: tenantId,
          userId: userId,
          zoomCallId: log.id,
          direction: log.direction === "inbound" ? "inbound" : "outbound",
          phoneNumber: log.callee_number || log.caller_number || "unknown",
          callerName: log.callee_name || log.caller_name,
          result: result,
          startTime: new Date(log.date_time),
          duration: log.duration || 0,
          hasRecording: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await mongoose.connection.db.collection("calllogs").updateOne(
          { zoomCallId: log.id },
          { $set: callLog },
          { upsert: true }
        );
        savedCount++;
      }

      console.log("保存した通話ログ:", savedCount);

      console.log("\nサンプル (最初の5件):");
      callData.call_logs.slice(0, 5).forEach((log, i) => {
        console.log((i+1) + ".", log.date_time, log.direction, log.caller_number, "->", log.callee_number, "(" + log.duration + "秒)");
      });
    }
  }

  // DB確認
  const count = await mongoose.connection.db.collection("calllogs").countDocuments();
  console.log("\nDB通話ログ総数:", count);

  await mongoose.disconnect();
  console.log("\n完了");
}

main().catch(console.error);
