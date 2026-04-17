import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

declare module "next-auth" {
  interface User {
    role?: string;
    autologEnabled?: boolean;
  }
  interface Session {
    user: User & { autologEnabled?: boolean };
  }
}

async function findUser(username: string) {
  const connectionString = process.env.AUTH_DATABASE_URL;
  if (!connectionString) {
    throw new Error("AUTH_DATABASE_URL non configurata nelle variabili d'ambiente");
  }
  const sql = neon(connectionString);
  // La tabella "User" è quella di App-Ticket gestita da Prisma
  const rows = await sql`
    SELECT id, username, password, role, autolog_enabled
    FROM "User"
    WHERE username = ${username}
    LIMIT 1
  `;
  return rows[0] || null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await findUser(credentials.username as string);
        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        // Gli utenti USER devono avere autolog_enabled = true per accedere
        // ADMIN e MASTER hanno sempre accesso
        if (user.role === "USER" && user.autolog_enabled === false) {
          return null;
        }

        return {
          id: user.id,
          name: user.username,
          role: user.role,
          autologEnabled: user.autolog_enabled !== false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.autologEnabled = user.autologEnabled;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role as string;
        (session.user as any).autologEnabled = token.autologEnabled as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
