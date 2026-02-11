import * as bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'default-secret-change-in-production'
)

const COOKIE_NAME = 'auth-token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AuthUser {
    id: string
    employeeCode: string
    name: string
    role: 'EMPLOYEE' | 'ADMIN'
}

export interface TokenPayload extends JWTPayload {
    user: AuthUser
}

// パスワードをハッシュ化
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
}

// パスワードを検証
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

// PINをハッシュ化
export async function hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, 10)
}

// PINを検証
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash)
}

// JWTトークンを生成
export async function generateToken(user: AuthUser): Promise<string> {
    return new SignJWT({ user })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET)
}

// JWTトークンを検証
export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return payload as TokenPayload
    } catch {
        return null
    }
}

// トークンをCookieに設定
export async function setAuthCookie(token: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    })
}

// Cookieからトークンを取得
export async function getAuthCookie(): Promise<string | null> {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(COOKIE_NAME)
    return cookie?.value ?? null
}

// Cookieからトークンを削除
export async function removeAuthCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
}

// 現在のユーザーを取得
export async function getCurrentUser(): Promise<AuthUser | null> {
    const token = await getAuthCookie()
    if (!token) return null

    const payload = await verifyToken(token)
    if (!payload) return null

    return payload.user
}

// 管理者かどうかを確認
export async function isAdmin(): Promise<boolean> {
    const user = await getCurrentUser()
    return user?.role === 'ADMIN'
}

// 認証が必要なAPI用のヘルパー
export async function requireAuth(): Promise<AuthUser> {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('認証が必要です')
    }
    return user
}

// 管理者権限が必要なAPI用のヘルパー
export async function requireAdmin(): Promise<AuthUser> {
    const user = await requireAuth()
    if (user.role !== 'ADMIN') {
        throw new Error('管理者権限が必要です')
    }
    return user
}
