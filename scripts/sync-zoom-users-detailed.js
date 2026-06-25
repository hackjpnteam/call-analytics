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
  return data.access_token;
}

async function fetchAllPhoneUsers(token) {
  const allUsers = [];
  let nextPageToken = "";

  do {
    const url = "https://api.zoom.us/v2/phone/users?page_size=100" +
      (nextPageToken ? "&next_page_token=" + nextPageToken : "");

    const res = await fetch(url, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();

    if (data.users) {
      allUsers.push(...data.users);
    }
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);

  return allUsers;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB接続完了");

  const token = await getToken();
  console.log("Zoomトークン取得完了");

  const tenant = await mongoose.connection.db.collection("tenants").findOne({});
  const tenantId = tenant._id;

  // 全Zoom Phoneユーザー取得
  console.log("\nZoom Phoneユーザー取得中...");
  const phoneUsers = await fetchAllPhoneUsers(token);
  console.log("取得したZoom Phoneユーザー数:", phoneUsers.length);

  // 詳細情報でDBを更新
  let updated = 0;
  let created = 0;

  for (const zu of phoneUsers) {
    // 電話番号を抽出
    let phoneNumbers = [];
    if (zu.phone_numbers) {
      phoneNumbers = zu.phone_numbers.map(pn => pn.number);
    }

    const userData = {
      zoomUserId: zu.id,
      zoomPhoneUserId: zu.phone_user_id,
      zoomEmail: zu.email,
      zoomPhoneNumber: phoneNumbers[0] || null,
      zoomPhoneNumbers: phoneNumbers,
      zoomExtensionNumber: zu.extension_number,
      zoomExtensionId: zu.extension_id,
      zoomPhoneStatus: zu.status,
      zoomCallingPlans: zu.calling_plans?.map(cp => cp.name) || [],
      zoomSiteId: zu.site?.id,
      zoomSiteName: zu.site?.name,
      zoomDepartment: zu.department,
      zoomCostCenter: zu.cost_center,
      updatedAt: new Date()
    };

    // まずメールで既存ユーザー検索
    const existingUser = await mongoose.connection.db.collection("users").findOne({
      $or: [
        { email: zu.email },
        { zoomUserId: zu.id }
      ]
    });

    if (existingUser) {
      await mongoose.connection.db.collection("users").updateOne(
        { _id: existingUser._id },
        { $set: userData }
      );
      updated++;
    } else {
      // 新規作成
      await mongoose.connection.db.collection("users").insertOne({
        tenantId: tenantId,
        name: zu.name,
        email: zu.email,
        role: "operator",
        status: "offline",
        isActive: true,
        ...userData,
        createdAt: new Date()
      });
      created++;
    }
  }

  console.log("\n同期結果:");
  console.log("  更新:", updated);
  console.log("  新規作成:", created);

  // 統計を表示
  const users = await mongoose.connection.db.collection("users").find({ tenantId }).toArray();
  const linkedUsers = users.filter(u => u.zoomUserId);
  const activeUsers = users.filter(u => u.zoomPhoneStatus === "activate");

  console.log("\nユーザー統計:");
  console.log("  総ユーザー数:", users.length);
  console.log("  Zoom連携済み:", linkedUsers.length);
  console.log("  Zoom Phone有効:", activeUsers.length);

  // サイト別集計
  const siteCounts = {};
  for (const u of linkedUsers) {
    const site = u.zoomSiteName || "未設定";
    siteCounts[site] = (siteCounts[site] || 0) + 1;
  }
  console.log("\nサイト別ユーザー数:");
  Object.entries(siteCounts).forEach(([site, count]) => {
    console.log("  " + site + ": " + count);
  });

  // プラン別集計
  const planCounts = {};
  for (const u of linkedUsers) {
    const plans = u.zoomCallingPlans || [];
    if (plans.length === 0) {
      planCounts["プランなし"] = (planCounts["プランなし"] || 0) + 1;
    } else {
      for (const plan of plans) {
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      }
    }
  }
  console.log("\nプラン別ユーザー数:");
  Object.entries(planCounts).forEach(([plan, count]) => {
    console.log("  " + plan + ": " + count);
  });

  await mongoose.disconnect();
  console.log("\n完了");
}

main().catch(console.error);
