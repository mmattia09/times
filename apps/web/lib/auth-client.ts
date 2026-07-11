"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL: the client calls the same origin it's served from, so the app
// needs no public-URL env var and works behind any host/proxy.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
