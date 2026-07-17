import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashValue = (value: string): Promise<string> => bcrypt.hash(value, SALT_ROUNDS);

export const compareValue = (value: string, hash: string): Promise<boolean> => bcrypt.compare(value, hash);
