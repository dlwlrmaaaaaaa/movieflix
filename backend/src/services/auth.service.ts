import bcrypt from 'bcryptjs';
import { startAuthSession } from './authSession.service';
import { prisma } from '../prisma';
import { generateToken } from '../utils/token';
import { generateInviteCode } from '../utils/roomCode';
import { ENV } from '../config/env';
import { UserProfile, AuthTokens } from '@togetherflix/shared';

export class AuthService {
  static async register(email: string, password: string, displayName: string): Promise<AuthTokens> {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: displayName.trim(),
        // Bootstrap is server-configured; clients cannot choose a role.
        role: ENV.ADMIN_BOOTSTRAP_EMAIL === email.toLowerCase().trim() ? 'ADMIN' : 'USER',
      },
    });

    const sessionId = await startAuthSession(user.id);
    const accessToken = generateToken({ userId: user.id, email: user.email, sessionId });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        partnerId: null,
        partner: null,
        createdAt: user.createdAt.toISOString(),
        role: user.role,
      },
    };
  }

  static async login(email: string, password: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        partner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const sessionId = await startAuthSession(user.id);
    const accessToken = generateToken({ userId: user.id, email: user.email, sessionId });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        partnerId: user.partnerId,
        partner: user.partner,
        createdAt: user.createdAt.toISOString(),
        role: user.role,
      },
    };
  }

  static async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      partnerId: user.partnerId,
      partner: user.partner,
      createdAt: user.createdAt.toISOString(),
      role: user.role,
    };
  }

  static async createPartnerInvite(senderId: string, inviteEmail: string): Promise<{ inviteCode: string; expiresAt: Date }> {
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) throw new Error('Sender user not found.');

    if (sender.partnerId) {
      throw new Error('You are already linked with a partner. Please unlink first.');
    }

    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.partnerInvite.create({
      data: {
        senderId,
        inviteEmail: inviteEmail.toLowerCase().trim(),
        code,
        expiresAt,
      },
    });

    return { inviteCode: code, expiresAt };
  }

  static async acceptPartnerInvite(receiverId: string, inviteCode: string): Promise<UserProfile> {
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new Error('User not found.');
    if (receiver.partnerId) throw new Error('You already have a linked partner.');

    const invite = await prisma.partnerInvite.findUnique({
      where: { code: inviteCode.trim().toUpperCase() },
      include: { sender: true },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new Error('Invalid or expired partner invite code.');
    }

    if (invite.expiresAt < new Date()) {
      throw new Error('This partner invite has expired.');
    }

    if (invite.senderId === receiverId) {
      throw new Error('You cannot accept your own partner invite.');
    }

    // Connect both partners
    await prisma.$transaction([
      prisma.user.update({
        where: { id: receiverId },
        data: { partnerId: invite.senderId },
      }),
      prisma.user.update({
        where: { id: invite.senderId },
        data: { partnerId: receiverId },
      }),
      prisma.partnerInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          receiverId,
        },
      }),
    ]);

    return this.getProfile(receiverId);
  }

  static async unlinkPartner(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.partnerId) throw new Error('No partner linked to unlink.');

    const partnerId = user.partnerId;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { partnerId: null },
      }),
      prisma.user.update({
        where: { id: partnerId },
        data: { partnerId: null },
      }),
    ]);

    return this.getProfile(userId);
  }
}
