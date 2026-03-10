'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { UserRole } from '@/types';

interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  team?: string;
  department?: string;
  status: string;
  isActive: boolean;
  zoomUserId?: string;
  zoomPhoneNumber?: string;
  zoomExtensionNumber?: number;
  zoomPhoneStatus?: string;
  zoomCallingPlans?: string[];
  zoomSiteName?: string;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as UserRole,
    team: '',
    department: '',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // ユーザー一覧取得
  const fetchUsers = useCallback(async () => {
    if (!session?.user?.tenantId) return;

    try {
      const res = await fetch(`/api/users?tenantId=${session.user.tenantId}`);
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.tenantId]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [session, status, router, fetchUsers]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return null;
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name.includes(searchQuery) ||
      user.email.includes(searchQuery) ||
      user.team?.includes(searchQuery) || false
  );

  // ユーザー追加
  const handleAddUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert('名前、メール、パスワードは必須です');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: session.user.tenantId,
          ...formData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsAddDialogOpen(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'operator',
          team: '',
          department: '',
        });
        fetchUsers();
      } else {
        alert(data.error || '追加に失敗しました');
      }
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // ユーザー編集
  const handleEditUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          team: formData.team,
          department: formData.department,
          ...(formData.password && { password: formData.password }),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsEditDialogOpen(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || '更新に失敗しました');
      }
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // ユーザー削除
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('本当にこのユーザーを削除しますか？')) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || '削除に失敗しました');
      }
    } catch (err) {
      alert('エラーが発生しました');
    }
  };

  // 編集ダイアログを開く
  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      team: user.team || '',
      department: user.department || '',
    });
    setIsEditDialogOpen(true);
  };

  return (
    <DashboardLayout
      userRole={session.user.role}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
            <p className="text-gray-600">オペレーターの追加・編集・削除</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData({
                name: '',
                email: '',
                password: '',
                role: 'operator',
                team: '',
                department: '',
              })}>
                <Plus className="h-4 w-4 mr-2" />
                ユーザー追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新規ユーザー追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名前 *</Label>
                  <Input
                    id="name"
                    placeholder="山田太郎"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="yamada@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">パスワード *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">ロール</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">オペレーター</SelectItem>
                      <SelectItem value="admin">管理者</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">チーム</Label>
                  <Input
                    id="team"
                    placeholder="営業1課"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">部署</Label>
                  <Input
                    id="department"
                    placeholder="営業部"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleAddUser} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  追加
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 編集ダイアログ */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ユーザー編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>名前</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>メールアドレス</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>新しいパスワード（変更する場合のみ）</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="変更しない場合は空欄"
                />
              </div>
              <div className="space-y-2">
                <Label>ロール</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">オペレーター</SelectItem>
                    <SelectItem value="admin">管理者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>チーム</Label>
                <Input
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleEditUser} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                更新
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                ユーザー一覧（{filteredUsers.length}名）
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="名前・メール・チームで検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ユーザー</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>ロール</TableHead>
                  <TableHead>Zoom Phone</TableHead>
                  <TableHead>内線</TableHead>
                  <TableHead>プラン</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      ユーザーがいません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-blue-100 text-blue-700">
                              {user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '管理者' : 'オペレーター'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.zoomUserId ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                              <span className="text-sm text-green-600">連携済み</span>
                            </div>
                            {user.zoomPhoneNumber && (
                              <span className="text-xs text-gray-500">{user.zoomPhoneNumber}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 bg-gray-300 rounded-full"></span>
                            <span className="text-sm text-gray-400">未連携</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.zoomExtensionNumber ? (
                          <span className="text-sm font-mono">{user.zoomExtensionNumber}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.zoomCallingPlans && user.zoomCallingPlans.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {user.zoomCallingPlans.map((plan, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {plan.replace('JP ', '').replace(' Plan', '')}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteUser(user._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
