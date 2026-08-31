import { randomUUID } from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function newPlayerId(): string {
  return randomUUID();
}

export function newRoomCode(existing: (code: string) => boolean): string {
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (existing(code));
  return code;
}

export function newChatId(): string {
  return randomUUID();
}

export function newMatchId(): string {
  return randomUUID();
}
