import mongoose from 'mongoose';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
  const tenant = await Tenant.findOne().lean() as Record<string, unknown>;

  const config = tenant?.zoomPhoneConfig as Record<string, string> | undefined;
  if (!config) {
    console.log('Zoom設定なし');
    return;
  }

  console.log('Account ID:', config.accountId ? '設定済み' : 'なし');
  console.log('Client ID:', config.clientId ? '設定済み' : 'なし');
  console.log('Client Secret:', config.clientSecret ? '設定済み' : 'なし');

  // トークン取得テスト
  const credentials = Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64');

  const tokenRes = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=account_credentials&account_id=' + config.accountId,
  });

  if (!tokenRes.ok) {
    const error = await tokenRes.text();
    console.log('トークン取得エラー:', tokenRes.status, error);
    await mongoose.disconnect();
    return;
  }

  const tokenData = await tokenRes.json();
  console.log('トークン取得: 成功');

  // 通話ログ取得テスト
  const now = new Date();
  const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split('T')[0];
  const toStr = now.toISOString().split('T')[0];

  const logsRes = await fetch(
    `https://api.zoom.us/v2/phone/call_logs?from=${fromStr}&to=${toStr}&page_size=10`,
    { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
  );

  if (!logsRes.ok) {
    const error = await logsRes.text();
    console.log('通話ログ取得エラー:', logsRes.status, error);
  } else {
    const logs = await logsRes.json() as { call_logs?: Array<{ date_time?: string; start_time?: string }> };
    console.log('通話ログ取得: 成功');
    console.log('件数:', logs.call_logs?.length || 0);
    console.log('期間:', fromStr, '〜', toStr);
    if (logs.call_logs?.[0]) {
      console.log('最新通話:', logs.call_logs[0].date_time || logs.call_logs[0].start_time);
    }
  }

  await mongoose.disconnect();
}

check().catch(e => console.error('エラー:', e));
