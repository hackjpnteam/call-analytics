'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, Clock, Database, Shield, RefreshCw, CheckCircle, XCircle, Loader2, FileBox, Download, Upload } from 'lucide-react';
import { FullPageLoading } from '@/components/ui/loading-spinner';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Zoom設定
  const [zoomAccountId, setZoomAccountId] = useState('');
  const [zoomClientId, setZoomClientId] = useState('');
  const [zoomClientSecret, setZoomClientSecret] = useState('');
  const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);
  const [zoomTesting, setZoomTesting] = useState(false);
  const [zoomSaving, setZoomSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // 勤務時間設定
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [breakDuration, setBreakDuration] = useState('60');
  const [retentionDays, setRetentionDays] = useState('180');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);


  // FileMaker設定
  const [fmHost, setFmHost] = useState('');
  const [fmDatabase, setFmDatabase] = useState('');
  const [fmUsername, setFmUsername] = useState('');
  const [fmPassword, setFmPassword] = useState('');
  const [fmCustomerLayout, setFmCustomerLayout] = useState('');
  const [fmCallLogLayout, setFmCallLogLayout] = useState('');
  const [fmConnected, setFmConnected] = useState<boolean | null>(null);
  const [fmTesting, setFmTesting] = useState(false);
  const [fmSaving, setFmSaving] = useState(false);
  const [fmSyncing, setFmSyncing] = useState(false);
  const [fmSyncStatus, setFmSyncStatus] = useState<string | null>(null);

  // 設定読み込み
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/tenants/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setWorkStartTime(data.settings.workStartTime || '09:00');
            setWorkEndTime(data.settings.workEndTime || '18:00');
            setBreakDuration(String(data.settings.breakDuration || 60));
            const retention = data.settings.recordingRetentionDays;
            setRetentionDays(retention === -1 ? 'unlimited' : String(retention || 180));
          }
        }

        // FileMaker設定読み込み
        const fmRes = await fetch('/api/filemaker/config');
        if (fmRes.ok) {
          const fmData = await fmRes.json();
          if (fmData.config) {
            setFmHost(fmData.config.host || '');
            setFmDatabase(fmData.config.database || '');
            setFmUsername(fmData.config.username || '');
            setFmCustomerLayout(fmData.config.customerLayout || '');
            setFmCallLogLayout(fmData.config.callLogLayout || '');
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    if (session) {
      loadSettings();
    }
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'admin') {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (!session || session.user.role !== 'admin') {
    return null;
  }

  // Zoom接続テスト
  const handleTestConnection = async () => {
    setZoomTesting(true);
    setZoomConnected(null);

    try {
      const res = await fetch('/api/zoom/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: zoomAccountId,
          clientId: zoomClientId,
          clientSecret: zoomClientSecret,
        }),
      });

      const data = await res.json();
      setZoomConnected(data.success);
    } catch {
      setZoomConnected(false);
    } finally {
      setZoomTesting(false);
    }
  };

  // Zoom設定保存
  const handleSaveZoomConfig = async () => {
    setZoomSaving(true);

    try {
      const res = await fetch('/api/zoom/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          accountId: zoomAccountId,
          clientId: zoomClientId,
          clientSecret: zoomClientSecret,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Zoom設定を保存しました');
      } else {
        alert('保存に失敗しました: ' + data.error);
      }
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setZoomSaving(false);
    }
  };

  // 勤務時間設定保存
  const handleSaveWorkHours = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);

    try {
      const res = await fetch('/api/tenants/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workStartTime,
          workEndTime,
          breakDuration,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSettingsMessage('勤務時間設定を保存しました');
      } else {
        setSettingsMessage('保存に失敗しました: ' + data.error);
      }
    } catch (error) {
      setSettingsMessage('エラーが発生しました');
    } finally {
      setSettingsSaving(false);
    }
  };

  // 録音保管設定保存
  const handleSaveRetention = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);

    try {
      const res = await fetch('/api/tenants/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingRetentionDays: retentionDays,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSettingsMessage('録音保管設定を保存しました');
      } else {
        setSettingsMessage('保存に失敗しました: ' + data.error);
      }
    } catch (error) {
      setSettingsMessage('エラーが発生しました');
    } finally {
      setSettingsSaving(false);
    }
  };

  // FileMaker接続テスト
  const handleFmTestConnection = async () => {
    setFmTesting(true);
    setFmConnected(null);

    try {
      const res = await fetch('/api/filemaker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: fmHost,
          database: fmDatabase,
          username: fmUsername,
          password: fmPassword,
          customerLayout: fmCustomerLayout,
          callLogLayout: fmCallLogLayout,
        }),
      });

      const data = await res.json();
      setFmConnected(data.success);
    } catch {
      setFmConnected(false);
    } finally {
      setFmTesting(false);
    }
  };

  // FileMaker設定保存
  const handleSaveFmConfig = async () => {
    setFmSaving(true);

    try {
      const res = await fetch('/api/filemaker/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: fmHost,
          database: fmDatabase,
          username: fmUsername,
          password: fmPassword,
          customerLayout: fmCustomerLayout,
          callLogLayout: fmCallLogLayout,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('FileMaker設定を保存しました');
      } else {
        alert('保存に失敗しました: ' + data.error);
      }
    } catch {
      alert('エラーが発生しました');
    } finally {
      setFmSaving(false);
    }
  };

  // FileMaker顧客データインポート
  const handleFmImportCustomers = async () => {
    setFmSyncing(true);
    setFmSyncStatus(null);

    try {
      const res = await fetch('/api/filemaker/sync/customers', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setFmSyncStatus(
          `顧客インポート完了: ${data.stats.created}件作成, ${data.stats.updated}件更新`
        );
      } else {
        setFmSyncStatus('インポートに失敗しました: ' + data.error);
      }
    } catch {
      setFmSyncStatus('インポートに失敗しました');
    } finally {
      setFmSyncing(false);
    }
  };

  // FileMaker通話ログエクスポート
  const handleFmExportCallLogs = async () => {
    setFmSyncing(true);
    setFmSyncStatus(null);

    try {
      const res = await fetch('/api/filemaker/sync/calllogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyUnsynced: true }),
      });
      const data = await res.json();

      if (data.success) {
        setFmSyncStatus(
          `通話ログエクスポート完了: ${data.stats.exported}件エクスポート`
        );
      } else {
        setFmSyncStatus('エクスポートに失敗しました: ' + data.error);
      }
    } catch {
      setFmSyncStatus('エクスポートに失敗しました');
    } finally {
      setFmSyncing(false);
    }
  };

  // 手動同期
  const handleManualSync = async () => {
    setSyncing(true);
    setSyncStatus(null);

    try {
      // 通話ログ同期
      const callRes = await fetch('/api/sync/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
        }),
      });
      const callData = await callRes.json();

      // 録音同期
      const recRes = await fetch('/api/sync/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
        }),
      });
      const recData = await recRes.json();

      setSyncStatus(
        `通話: ${callData.stats?.created || 0}件作成, ${callData.stats?.updated || 0}件更新 / ` +
        `録音: ${recData.stats?.created || 0}件作成`
      );
    } catch (err) {
      setSyncStatus('同期に失敗しました');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <DashboardLayout
      userRole={session.user.role}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
          <p className="text-gray-600">システム設定の管理</p>
        </div>

        <div className="grid gap-6">
          {/* Zoom Phone連携 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Zoom Phone API連携
              </CardTitle>
              <CardDescription>
                Zoom PhoneのServer-to-Server OAuth認証情報を設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Account ID</Label>
                <Input
                  placeholder="Zoom Account ID"
                  value={zoomAccountId}
                  onChange={(e) => setZoomAccountId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  placeholder="OAuth Client ID"
                  value={zoomClientId}
                  onChange={(e) => setZoomClientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  placeholder="OAuth Client Secret"
                  value={zoomClientSecret}
                  onChange={(e) => setZoomClientSecret(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">接続状態</p>
                  <div className="flex items-center gap-2 mt-1">
                    {zoomConnected === null && (
                      <Badge variant="secondary">未テスト</Badge>
                    )}
                    {zoomConnected === true && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        接続成功
                      </Badge>
                    )}
                    {zoomConnected === false && (
                      <Badge className="bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        接続失敗
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={zoomTesting || !zoomAccountId || !zoomClientId || !zoomClientSecret}
                >
                  {zoomTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      テスト中...
                    </>
                  ) : (
                    '接続テスト'
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveZoomConfig} disabled={zoomSaving}>
                  {zoomSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '設定を保存'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={syncing || !zoomConnected}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      同期中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      今すぐ同期
                    </>
                  )}
                </Button>
              </div>

              {syncStatus && (
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {syncStatus}
                </p>
              )}
            </CardContent>
          </Card>

          {/* FileMaker連携 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileBox className="h-5 w-5" />
                FileMaker連携
              </CardTitle>
              <CardDescription>
                FileMaker Data APIの接続設定と顧客データ同期
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>サーバーホスト</Label>
                  <Input
                    placeholder="https://your-server.com"
                    value={fmHost}
                    onChange={(e) => setFmHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>データベース名</Label>
                  <Input
                    placeholder="データベース名"
                    value={fmDatabase}
                    onChange={(e) => setFmDatabase(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ユーザー名</Label>
                  <Input
                    placeholder="ユーザー名"
                    value={fmUsername}
                    onChange={(e) => setFmUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>パスワード</Label>
                  <Input
                    type="password"
                    placeholder="パスワード"
                    value={fmPassword}
                    onChange={(e) => setFmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>顧客レイアウト名</Label>
                  <Input
                    placeholder="顧客マスタ"
                    value={fmCustomerLayout}
                    onChange={(e) => setFmCustomerLayout(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>通話ログレイアウト名</Label>
                  <Input
                    placeholder="通話履歴"
                    value={fmCallLogLayout}
                    onChange={(e) => setFmCallLogLayout(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">接続状態</p>
                  <div className="flex items-center gap-2 mt-1">
                    {fmConnected === null && (
                      <Badge variant="secondary">未テスト</Badge>
                    )}
                    {fmConnected === true && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        接続成功
                      </Badge>
                    )}
                    {fmConnected === false && (
                      <Badge className="bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        接続失敗
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleFmTestConnection}
                  disabled={fmTesting || !fmHost || !fmDatabase || !fmUsername || !fmPassword}
                >
                  {fmTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      テスト中...
                    </>
                  ) : (
                    '接続テスト'
                  )}
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSaveFmConfig} disabled={fmSaving}>
                  {fmSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '設定を保存'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleFmImportCustomers}
                  disabled={fmSyncing || !fmConnected}
                >
                  {fmSyncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  顧客インポート
                </Button>
                <Button
                  variant="outline"
                  onClick={handleFmExportCallLogs}
                  disabled={fmSyncing || !fmConnected}
                >
                  {fmSyncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  通話ログエクスポート
                </Button>
              </div>

              {fmSyncStatus && (
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {fmSyncStatus}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 勤務時間設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                勤務時間設定
              </CardTitle>
              <CardDescription>
                アイドル時間の計算に使用される勤務時間を設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>勤務開始時間</Label>
                  <Select value={workStartTime} onValueChange={setWorkStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`}>
                          {String(i).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>勤務終了時間</Label>
                  <Select value={workEndTime} onValueChange={setWorkEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={`${String(i).padStart(2, '0')}:00`}>
                          {String(i).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>休憩時間（分）</Label>
                <Input
                  type="number"
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleSaveWorkHours} disabled={settingsSaving}>
                {settingsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 録音設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                録音保管設定
              </CardTitle>
              <CardDescription>
                録音ファイルの保管期間を設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>保管期間</Label>
                <Select value={retentionDays} onValueChange={setRetentionDays}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90日</SelectItem>
                    <SelectItem value="180">180日（6ヶ月）</SelectItem>
                    <SelectItem value="365">365日（1年）</SelectItem>
                    <SelectItem value="unlimited">無期限</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveRetention} disabled={settingsSaving}>
                {settingsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </Button>
              {settingsMessage && (
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-2">
                  {settingsMessage}
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
