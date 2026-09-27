import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { emailOTP } from 'better-auth/plugins';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const mongoUri = process.env.MONGODB_URI!;
const client = new MongoClient(mongoUri);
const db = client.db();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : [],
  account: {
    skipStateCookieCheck: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  database: mongodbAdapter(db, { client }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        let subject = "Your Verification Code";
        let message = `Your 4-digit code is: <strong>${otp}</strong>`;
        
        if (type === "forget-password") {
            subject = "Reset Your Password - Rocky Legal";
            message = `We received a request to reset your password. Your 4-digit reset code is: <h2 style="color: #C7A064; letter-spacing: 4px;">${otp}</h2><p>This code expires in 5 minutes.</p>`;
        } else if (type === "sign-in" || type === "email-verification") {
            subject = "Verify your Email - Rocky Legal";
            message = `Welcome to Rocky Legal! Your 4-digit verification code is: <h2 style="color: #C7A064; letter-spacing: 4px;">${otp}</h2><p>This code expires in 5 minutes.</p>`;
        }

        await transporter.sendMail({
          from: `"Rocky Legal" <${process.env.EMAIL_USER}>`,
          to: email,
          subject,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">${message}</div>`,
        });
        console.log(`✅ ${type} OTP sent to ${email}`);
      },
      otpLength: 4,
      expiresIn: 300, // 5 minutes
      sendVerificationOnSignUp: true,
    })
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      fullName: {
        type: 'string',
        required: false,
      },
      mobile: {
        type: 'string',
        required: false,
      },
    },
  },
});