import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { QdrantModule } from './qdrant/qdrant.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { auth } from './auth';
import { ChatModule } from './chat/chat.module';
import { LanggraphModule } from './langgraph/langgraph.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Mongoose connection (MongoDB)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        onConnectionCreate: () => {
          console.log('✅ MongoDB connected successfully');
        },
        serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is down
      }),
    }),

    // BullMQ — Redis-backed job queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: 6379,
          password:configService.get<string>('REDIS_PASSWORD'),
          maxRetriesPerRequest: null,
          retryStrategy: (times) => {
            if (times > 3) {
              console.error('❌ FATAL: Redis connection failed. Shutting down backend!');
              process.exit(1);
            }
            return Math.min(times * 100, 3000);
          },
        },
      }),
    }),
    QdrantModule,
    IngestionModule,

    // Better Auth — handles all /api/auth/* routes + global AuthGuard
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '5mb' },
        urlencoded: { limit: '5mb', extended: true },
      },
    }),

    // Active Feature modules
    UserModule,
    ChatModule,
    LanggraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
