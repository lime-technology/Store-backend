// Simple in-memory user store (file-based persistence alternative could be added later)
// Each user: { email: string, password: string }

export interface User {
  email: string;
  password: string;
}

// In-memory store — resets on server restart
const users: User[] = [];

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

export function createUser(email: string, password: string): User {
  const user: User = { email, password };
  users.push(user);
  return user;
}
