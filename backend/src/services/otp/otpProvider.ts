export interface OtpProvider {
  name: string;
  sendOtp(phone: string, otp: string): Promise<void>;
}
