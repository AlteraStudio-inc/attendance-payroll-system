import * as bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
)

const COOKIE_NAME = 'auth-token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AuthUser {
  id: string // user.id
  employeeId: string | null
  employeeCode: string | null
  name: string
  email: string | null
  role: 'admin' | 'employee'
  departmentId: string | null
  companyId: string | null
}

export interface TokenPayload extends JWTPayload {
  user: AuthUser
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export async function generateToken(user: AuthUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as TokenPayload
  } catch {
    return null
  }
}

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

export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  return cookie?.value ?? null
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getAuthCookie()
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return payload.user
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('認証が必要です')
  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') throw new Error('管理者権限が必要です')
  return user
}

/**
 * ログイン処理 - email + password で認証
 */
export async function loginWithEmail(email: string, password: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  })
  if (!user || !user.isActive) throw new Error('認証に失敗しました')
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new Error('認証に失敗しました')

  // Update lastLoginAt
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  return {
    id: user.id,
    employeeId: user.employeeId,
    employeeCode: user.employee?.employeeCode ?? null,
    name: user.employee?.name ?? 'Admin',
    email: user.email,
    role: user.role,
    departmentId: user.employee?.departmentId ?? null,
    companyId: user.employee?.companyId ?? null,
  }
}

/**
 * ログイン処理 - employeeCode + password/PIN で認証
 */
export async function loginWithEmployeeCode(employeeCode: string, credential: string): Promise<AuthUser> {
  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
    include: { user: true },
  })
  if (!employee || !employee.active || !employee.user || !employee.user.isActive) {
    throw new Error('認証に失敗しました')
  }

  // Try password first, then PIN
  let valid = await verifyPassword(credential, employee.user.passwordHash)
  if (!valid && employee.pinHash) {
    valid = await verifyPin(credential, employee.pinHash)
  }
  if (!valid) throw new Error('認証に失敗しました')

  await prisma.user.update({ where: { id: employee.user.id }, data: { lastLoginAt: new Date() } })

  return {
    id: employee.user.id,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    email: employee.user.email,
    role: employee.user.role,
    departmentId: employee.departmentId,
    companyId: employee.companyId,
  }
}
