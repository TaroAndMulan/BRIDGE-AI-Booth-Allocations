import importedTeams from './generated/teams.json';

export const CATEGORIES = {
  A: "Medical Education Award",
  B: "Clinical Award",
  C: "Digital Technology Award",
  D: "Medical AI Award"
} as const;

export const TRACKS = {
  RISING: "Rising Innovator",
  ADVANCED: "Advanced Innovator"
} as const;

export type Category = typeof CATEGORIES[keyof typeof CATEGORIES];
export type Track = typeof TRACKS[keyof typeof TRACKS];

export type Team = {
  /** Lowercased booth number, e.g. "bai-a01". */
  id: string;
  booth: string;
  category: Category;
  track: Track;
  /** Team name as submitted — Thai, often with embedded English. */
  teamName: string;
  /** Project title in English. */
  projectName: string;
  teamLeader: string;
};

/** The booth letter encodes the category, so a badge can be coloured from either. */
export const CATEGORY_LETTER: Record<Category, 'A' | 'B' | 'C' | 'D'> = {
  [CATEGORIES.A]: 'A',
  [CATEGORIES.B]: 'B',
  [CATEGORIES.C]: 'C',
  [CATEGORIES.D]: 'D',
};

/**
 * "Medical AI Award" → "Medical AI". Used for nav links, filter chips, and the
 * Category column, all of which already sit under an "Award"/"Category" heading.
 */
export function categoryLabel(category: Category): string {
  return category.replace(/ Award$/, '');
}

export const MOCK_TEAMS: Team[] = [
  { id: "bai-a01", booth: "BAI-A01", category: CATEGORIES.A, track: TRACKS.RISING, teamName: "V-SCENE: จำลองกรณีศึกษาเสมือนจริงด้วย AI", projectName: "V-SCENE: Personalized AI-Driven Flipped Classroom", teamLeader: "นาย เอกธนา อาศิรวาท" },
  { id: "bai-a06", booth: "BAI-A06", category: CATEGORIES.A, track: TRACKS.ADVANCED, teamName: "ระบบฝึกทักษะการสื่อสารทางคลินิก", projectName: "Clinical Communication Skills Trainer", teamLeader: "นางสาว ปุณยนุช วรกิจ" },
  { id: "bai-b01", booth: "BAI-B01", category: CATEGORIES.B, track: TRACKS.RISING, teamName: "ชุดตรวจภาวะติดเชื้อในกระแสเลือดแบบรวดเร็ว", projectName: "Rapid Sepsis Detection Kit", teamLeader: "นพ. อารักษ์ ตันติ" },
  { id: "bai-b11", booth: "BAI-B11", category: CATEGORIES.B, track: TRACKS.ADVANCED, teamName: "เครื่องติดตามคลื่นไฟฟ้าหัวใจแบบพกพา", projectName: "Portable ECG Monitor", teamLeader: "พญ. ณดา คูกิมิยะ" },
  { id: "bai-c01", booth: "BAI-C01", category: CATEGORIES.C, track: TRACKS.RISING, teamName: "แพลตฟอร์มโทรเวชกรรมสำหรับพื้นที่ห่างไกล", projectName: "Telemedicine Platform for Rural Areas", teamLeader: "นางสาว อุรัสยา สุขสวัสดิ์" },
  { id: "bai-c16", booth: "BAI-C16", category: CATEGORIES.C, track: TRACKS.ADVANCED, teamName: "ระบบเวชระเบียนบนบล็อกเชน", projectName: "Blockchain Health Records", teamLeader: "นาย พิมพ์ชนก เลิศพันธ์" },
  { id: "bai-d01", booth: "BAI-D01", category: CATEGORIES.D, track: TRACKS.RISING, teamName: "ระบบวิเคราะห์ภาพ MRI ด้วยปัญญาประดิษฐ์", projectName: "AI-Powered MRI Analysis", teamLeader: "นาย สุนนท์ สุวรรณเมธานนท์" },
  { id: "bai-d16", booth: "BAI-D16", category: CATEGORIES.D, track: TRACKS.ADVANCED, teamName: "แชตบอตคัดกรองสุขภาพจิต", projectName: "Chatbot for Mental Health Triage", teamLeader: "นาย ธนภพ ลีรัตนขจร" },
];

const dataSource = (import.meta.env.VITE_DATA_SOURCE ?? 'excel').trim().toLowerCase();

if (dataSource !== 'mock' && dataSource !== 'excel') {
  throw new Error(`Invalid VITE_DATA_SOURCE "${dataSource}". Use "mock" or "excel".`);
}

if (dataSource === 'excel' && importedTeams.length === 0) {
  throw new Error('Excel data is enabled, but no teams were imported. Run "npm run import:excel" first.');
}

/** Unordered; `sortTeams` in ./sort applies the default order and any column sort. */
export const TEAMS: Team[] = dataSource === 'excel'
  ? importedTeams as Team[]
  : MOCK_TEAMS;
