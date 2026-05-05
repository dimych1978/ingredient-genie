
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

// Временный, захардкоженный пользователь для теста
const users = [
  {
    id: "1",
    name: "admin",
    passwordHash: bcrypt.hashSync("password", 10), // Пароль: password
    role: "admin",
  },
];

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Логин", type: "text", placeholder: "admin" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          return null;
        }
        
        const user = users.find((u) => u.name === credentials.username);

        if (user && bcrypt.compareSync(credentials.password, user.passwordHash)) {
          // Возвращаем объект пользователя без хэша пароля
          return { id: user.id, name: user.name, role: user.role };
        } else {
          // В случае ошибки авторизации возвращаем null
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Обогащаем токен и сессию информацией о роли
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
