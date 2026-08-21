import { Controller, Get, Patch, Body, BadRequestException } from '@nestjs/common';
import {
  Session,
  AllowAnonymous,
} from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ObjectId } from 'mongodb';

@Controller('users')
export class UserController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get('me')
  async getProfile(@Session() session: UserSession) {
    return {
      success: true,
      user: session.user,
    };
  }

  @Patch('mobile')
  async updateMobile(
    @Session() session: UserSession,
    @Body('mobile') mobile: string,
  ) {
    if (!mobile) {
      throw new BadRequestException('Mobile number is required');
    }
    const db = this.connection.db;
    if (!db) {
      throw new BadRequestException('Database connection not available');
    }

    const userId = session?.user?.id;
    if (!userId) {
      throw new BadRequestException('User session not found');
    }

    // Try matching ObjectId first, fallback to raw string ID
    let updated = false;
    try {
      const res = await db.collection('user').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { mobile, updatedAt: new Date() } },
      );
      if (res.matchedCount > 0) updated = true;
    } catch {
      // not a valid ObjectId format
    }

    if (!updated) {
      await db.collection('user').updateOne(
        { _id: userId as any },
        { $set: { mobile, updatedAt: new Date() } },
      );
    }

    return {
      success: true,
      message: 'Mobile number updated successfully',
      mobile,
    };
  }

  @Get('public')
  @AllowAnonymous()
  async getPublic() {
    return { message: 'This is a public route — no auth required' };
  }
}