import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: DefaultSession["user"] & {
            id: string;
            role: string;
        };
    }

    // If you access user.id directly from the adapter’s User type:
    interface User {
        id: string;
        role: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        sub?: string; // NextAuth sets token.sub to the user id
        role?: string;
    }
}