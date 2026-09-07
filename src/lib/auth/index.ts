import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * Returns the signing key for session JWTs.
 *
 * Deliberately throws instead of falling back to a default: a hardcoded
 * fallback would live in the (public) source tree, and a misconfigured
 * deployment would silently sign sessions with a publicly known key
 * instead of failing where someone would notice.
 *
 * Read lazily rather than at module load so a missing value surfaces at
 * request time rather than breaking the build.
 */
function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` ' +
        'and add it to .env (locally) or to your hosting environment variables.'
    );
  }

  return new TextEncoder().encode(secret);
}

const SESSION_DURATION_DAYS = parseInt(
  process.env.SESSION_DURATION_DAYS || '7',
  10
);

const COOKIE_NAME = 'investor_terminal_session';

// =============================================================================
// PASSWORD HASHING
// =============================================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// =============================================================================
// JWT TOKENS
// =============================================================================

interface TokenPayload {
  userId: string;
  email: string;
}

export async function createToken(payload: TokenPayload): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getAuthSecret());

  return token;
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  // Resolved outside the try so a missing AUTH_SECRET propagates as a config
  // error instead of being swallowed and reported as an invalid token.
  const secret = getAuthSecret();

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

export async function createSession(userId: string, email: string): Promise<void> {
  const token = await createToken({ userId, email });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  // Verify token
  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  // Check if session exists in database
  const session = await prisma.session.findUnique({
    where: { token },
  });

  if (!session || session.expiresAt < new Date()) {
    // Session expired or not found - just return null
    // Cookie cleanup happens via logout route handler
    return null;
  }

  return payload;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    // Delete from database
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  // Clear cookie
  cookieStore.delete(COOKIE_NAME);
}

// =============================================================================
// USER OPERATIONS
// =============================================================================

export async function signUp(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Create session
    await createSession(user.id, user.email);

    return { success: true };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Create session
    await createSession(user.id, user.email);

    return { success: true };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: 'Failed to sign in' };
  }
}

export async function signOut(): Promise<void> {
  await destroySession();
}

// =============================================================================
// AUTH CHECK
// =============================================================================

export async function requireAuth(): Promise<TokenPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  return user;
}
