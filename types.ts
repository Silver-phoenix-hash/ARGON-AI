export interface Transcription {
  text: string;
  sender: 'user' | 'argon';
  timestamp: number;
}

export enum ArgonState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  OFFLINE = 'OFFLINE',
  SCANNING = 'SCANNING',
  VERIFYING = 'VERIFYING',
  LOCKED = 'LOCKED',
  PASSWORD_ENTRY = 'PASSWORD_ENTRY'
}

export interface SystemStat {
  label: string;
  value: string | number;
  unit: string;
}

export interface LinkedDevice {
  id: string;
  name: string;
  type: string;
  distance: string;
  status: 'linked' | 'unauthorized' | 'scanning';
  isPowered?: boolean;
}