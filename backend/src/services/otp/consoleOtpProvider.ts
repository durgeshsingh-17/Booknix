import { logger } from '../../config/logger';
import { OtpProvider } from './otpProvider';

/**
 * Default OTP delivery: logs to the server console instead of sending a real
 * SMS. No SMS gateway (MSG91/Twilio/etc.) is configured yet — see
 * docs/SAAS_SCALING.md for the swap-in path. This keeps the customer OTP
 * login flow fully functional end-to-end in development/demo without
 * requiring a paid SMS account, while the provider interface means plugging
 * in a real gateway later is a one-file change, not a rearchitecture.
 */
export const consoleOtpProvider: OtpProvider = {
  name: 'console',
  async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info(`[OTP] ${otp} for ${phone} (console provider — configure a real SMS gateway before going live)`);
  },
};
