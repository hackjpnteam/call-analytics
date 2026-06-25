import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { UserRole } from '@/types';

declare module 'next-auth' {
  interface User {
    id: string;
    tenantId: string;
    role: UserRole;
    name: string;
    email: string;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
      name: string;
      email: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    tenantId: string;
    role: UserRole;
  }
}

// デモ用ユーザー（DB接続がない場合のフォールバック）
const DEMO_USERS = [
  {
    id: 'user-1',
    tenantId: '69a94e30bf29e01c468e0951',
    email: 'tomura@hackjpn.com',
    password: 'hikarutomura',
    name: '戸村光',
    role: 'admin' as UserRole,
  },
  {
    id: 'user-2',
    tenantId: '69a94e30bf29e01c468e0951',
    email: 'team@hackjpn.com',
    password: 'hj12042014xm',
    name: 'チームメンバー',
    role: 'operator' as UserRole,
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // まずDB認証を試行
        try {
          const { connectDB } = await import('@/lib/db/mongodb');
          const { default: User } = await import('@/models/User');

          await connectDB();

          const user = await User.findOne({
            email: credentials.email,
            isActive: true,
          });

          if (user) {
            const isValid = await user.comparePassword(credentials.password as string);
            if (isValid) {
              return {
                id: user._id.toString(),
                tenantId: user.tenantId.toString(),
                role: user.role,
                name: user.name,
                email: user.email,
              };
            }
          }
        } catch (error) {
          console.log('DB auth failed, falling back to demo mode:', error);
        }

        // フォールバック: デモユーザーで認証
        const demoUser = DEMO_USERS.find(
          (u) =>
            u.email === credentials.email && u.password === credentials.password
        );

        if (demoUser) {
          return {
            id: demoUser.id,
            tenantId: demoUser.tenantId,
            role: demoUser.role,
            name: demoUser.name,
            email: demoUser.email,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.tenantId = token.tenantId;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
});
