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
  return data.access_token;
}

async function fetchCallHistory(token, from, to, nextPageToken = "") {
  const url = `https://api.zoom.us/v2/phone/call_history?from=${from}&to=${to}&page_size=100` +
    (nextPageToken ? `&next_page_token=${nextPageToken}` : "");

  const res = await fetch(url, {
    headers: { "Authorization": "Bearer " + token }
  });
  return res.json();
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB接続完了");

  const token = await getToken();
  console.log("Zoomトークン取得完了");

  const tenant = await mongoose.connection.db.collection("tenants").findOne({});
  const tenantId = tenant._id;

  // ユーザーマップ作成
  const users = await mongoose.connection.db.collection("users").find({ tenantId }).toArray();
  const userIdMap = new Map();
  users.forEach(u => {
    if (u.zoomUserId) userIdMap.set(u.zoomUserId, u._id);
    if (u.zoomExtensionId) userIdMap.set(u.zoomExtensionId, u._id);
  });
  const defaultUserId = users[0]?._id;

  // 過去30日間のデータを取得
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = today.toISOString().split("T")[0];

  console.log(`\n通話履歴取得: ${fromStr} 〜 ${toStr}`);

  let totalFetched = 0;
  let totalSaved = 0;
  let nextPageToken = "";
  let pageCount = 0;
  const maxPages = 50; // 最大50ページ（5000件）

  do {
    pageCount++;
    const data = await fetchCallHistory(token, fromStr, toStr, nextPageToken);

    if (data.code) {
      console.log("エラー:", data.message);
      break;
    }

    if (pageCount === 1) {
      console.log(`総レコード数: ${data.total_records}`);
    }

    const callLogs = data.call_logs || [];
    totalFetched += callLogs.length;

    for (const log of callLogs) {
      // ユーザーID特定
      let userId = userIdMap.get(log.user_id) || userIdMap.get(log.caller_ext_id) || defaultUserId;

      // 結果判定
      let result = "connected";
      const r = (log.result || "").toLowerCase();
      if (r.includes("no_answer") || r.includes("no answer") || r.includes("missed")) result = "no_answer";
      else if (r.includes("busy")) result = "busy";
      else if (r.includes("voicemail")) result = "voicemail";
      else if (r.includes("cancel")) result = "cancelled";
      else if (r.includes("fail") || r.includes("reject")) result = "failed";
      else if (log.duration === 0 && log.result !== "call_connected") result = "no_answer";

      const callLog = {
        tenantId: tenantId,
        userId: userId,
        zoomCallId: log.id,
        zoomCallPathId: log.call_path_id,
        direction: log.direction === "inbound" ? "inbound" : "outbound",
        phoneNumber: log.callee_number || log.caller_number || "unknown",
        callerNumber: log.caller_number,
        calleeNumber: log.callee_number,
        callerName: log.caller_name,
        calleeName: log.callee_name,
        result: result,
        zoomResult: log.result,
        startTime: new Date(log.date_time),
        duration: log.duration || 0,
        callType: log.call_type,
        connectType: log.connect_type,
        hasRecording: !!log.recording_id,
        zoomRecordingId: log.recording_id,
        updatedAt: new Date()
      };

      await mongoose.connection.db.collection("calllogs").updateOne(
        { zoomCallId: log.id },
        { $set: callLog, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      totalSaved++;
    }

    console.log(`ページ ${pageCount}: ${callLogs.length}件 (累計: ${totalFetched}件)`);
    nextPageToken = data.next_page_token || "";

  } while (nextPageToken && pageCount < maxPages);

  // 統計表示
  const dbCount = await mongoose.connection.db.collection("calllogs").countDocuments({ tenantId });
  console.log(`\n=== 同期完了 ===`);
  console.log(`取得: ${totalFetched}件`);
  console.log(`保存: ${totalSaved}件`);
  console.log(`DB総数: ${dbCount}件`);

  // 結果別集計
  const resultStats = await mongoose.connection.db.collection("calllogs").aggregate([
    { $match: { tenantId } },
    { $group: { _id: "$result", count: { $sum: 1 } } }
  ]).toArray();
  console.log("\n結果別:");
  resultStats.forEach(r => console.log(`  ${r._id}: ${r.count}件`));

  // 方向別集計
  const dirStats = await mongoose.connection.db.collection("calllogs").aggregate([
    { $match: { tenantId } },
    { $group: { _id: "$direction", count: { $sum: 1 } } }
  ]).toArray();
  console.log("\n方向別:");
  dirStats.forEach(r => console.log(`  ${r._id}: ${r.count}件`));

  await mongoose.disconnect();
  console.log("\n完了");
}

main().catch(console.error);
