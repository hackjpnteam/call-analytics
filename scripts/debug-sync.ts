import mongoose from 'mongoose';

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  const tenant = await Tenant.findOne().lean() as Record<string, unknown>;
  const config = tenant?.zoomPhoneConfig as Record<string, string>;

  // トークン取得
  const credentials = Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64');
  const tokenRes = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=account_credentials&account_id=' + config.accountId,
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // 最初のユーザーでテスト
  const testUser = await User.findOne({ zoomUserId: { $exists: true, $ne: null } }).lean() as Record<string, unknown>;
  console.log('テストユーザー:', testUser?.name, '| zoomUserId:', testUser?.zoomUserId);

  // ユーザー別通話ログ取得テスト
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fromStr = twoDaysAgo.toISOString().split('T')[0];
  const toStr = now.toISOString().split('T')[0];

  const userLogsRes = await fetch(
    `https://api.zoom.us/v2/phone/users/${testUser?.zoomUserId}/call_logs?from=${fromStr}&to=${toStr}&page_size=10`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  console.log('ユーザー別ログ取得:', userLogsRes.status);
  if (userLogsRes.ok) {
    const data = await userLogsRes.json() as { call_logs?: unknown[] };
    console.log('件数:', data.call_logs?.length || 0);
  } else {
    console.log('エラー:', await userLogsRes.text());
  }

  // アカウント全体の通話ログも確認
  const allLogsRes = await fetch(
    `https://api.zoom.us/v2/phone/call_logs?from=${fromStr}&to=${toStr}&page_size=10`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  console.log('\nアカウント全体ログ取得:', allLogsRes.status);
  if (allLogsRes.ok) {
    const data = await allLogsRes.json() as { call_logs?: Array<{ owner?: { id?: string; name?: string }; date_time?: string }> };
    console.log('件数:', data.call_logs?.length || 0);
    if (data.call_logs?.[0]) {
      console.log('最新:', data.call_logs[0].date_time);
      console.log('オーナー:', data.call_logs[0].owner);
    }
  }

  await mongoose.disconnect();
}

debug().catch(console.error);
