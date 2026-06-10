#!/usr/bin/env node
// Migrate all lucide-react imports to @phosphor-icons/react
// Excludes src/app/components/ui/ (Shadcn primitives — keep as-is)

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = '/home/user/PawPilotPro/project';

// ── Lucide → Phosphor name mapping ───────────────────────────────────────────
const MAP = {
  // Chevrons → Carets
  ChevronDown: 'CaretDown',
  ChevronLeft: 'CaretLeft',
  ChevronRight: 'CaretRight',
  ChevronUp: 'CaretUp',
  ChevronsLeft: 'CaretDoubleLeft',
  ChevronsRight: 'CaretDoubleRight',
  ChevronDownIcon: 'CaretDown',
  ChevronRightIcon: 'CaretRight',

  // Search
  Search: 'MagnifyingGlass',
  SearchIcon: 'MagnifyingGlass',
  ZoomIn: 'MagnifyingGlassPlus',
  ZoomOut: 'MagnifyingGlassMinus',

  // Alerts / feedback
  AlertTriangle: 'Warning',
  AlertCircle: 'Warning',
  ShieldAlert: 'ShieldWarning',
  Ban: 'Prohibit',
  FileWarning: 'FileDashed',

  // Edit / CRUD
  Edit: 'PencilSimple',
  Edit2: 'PencilSimple',
  Edit3: 'PencilSimple',
  Pencil: 'PencilSimple',
  PenLine: 'PencilLine',
  Trash: 'Trash',
  Trash2: 'Trash',
  Save: 'FloppyDisk',

  // Auth / security
  LogIn: 'SignIn',
  LogOut: 'SignOut',
  EyeOff: 'EyeSlash',
  Unlock: 'LockOpen',

  // People
  Users: 'UsersThree',
  UserX: 'UserMinus',

  // Buildings / places
  Building: 'Buildings',
  Building2: 'Buildings',
  Home: 'House',

  // Files / docs
  Download: 'DownloadSimple',
  Upload: 'UploadSimple',
  Clipboard: 'ClipboardText',
  ClipboardList: 'ClipboardText',
  ClipboardCheck: 'ClipboardText',

  // Communication
  Mail: 'EnvelopeSimple',
  MessageCircle: 'ChatCircle',
  MessageSquare: 'ChatSquare',
  Send: 'PaperPlaneTilt',

  // Calendar / time
  Calendar: 'CalendarBlank',
  CalendarDays: 'CalendarBlank',

  // Charts / trends
  BarChart2: 'ChartBar',
  BarChart3: 'ChartBar',
  BarChart4: 'ChartBar',
  LineChart: 'ChartLine',
  PieChart: 'ChartPie',
  TrendingUp: 'TrendUp',
  TrendingDown: 'TrendDown',
  LayoutDashboard: 'Gauge',

  // Loaders
  Loader: 'CircleNotch',
  Loader2: 'CircleNotch',
  RefreshCw: 'ArrowClockwise',
  RefreshCcw: 'ArrowCounterClockwise',

  // Layout / grid
  LayoutGrid: 'SquaresFour',
  Grid: 'SquaresFour',
  Layers: 'Stack',
  Package2: 'Package',
  Box: 'Package',

  // Navigation
  Navigation: 'NavigationArrow',
  ExternalLink: 'ArrowSquareOut',

  // Media
  Mic: 'Microphone',
  Volume2: 'SpeakerHigh',

  // Config
  Settings: 'Gear',
  Filter: 'Funnel',
  GripVertical: 'DotsSixVertical',
  GripVerticalIcon: 'DotsSixVertical',
  MoreHorizontal: 'DotsThree',
  MoreVertical: 'DotsThreeVertical',

  // Mood
  Smile: 'Smiley',
  Frown: 'SmileySad',
  Meh: 'SmileyMeh',

  // Misc
  Share2: 'ShareNetwork',
  Share: 'ShareNetwork',
  Smartphone: 'DeviceMobile',
  SortAsc: 'SortAscending',
  SortDesc: 'SortDescending',
  ArrowUpDown: 'ArrowsDownUp',
  HardDrive: 'HardDrive',
  Server: 'HardDrives',
  MinusIcon: 'Minus',
  CircleIcon: 'Circle',
  CheckIcon: 'Check',
  CheckCircle2: 'CheckCircle',
  XCircle: 'XCircle',

  // These exist in Phosphor with same name — no rename needed but listed for clarity
  // Plus, Minus, X, Eye, Lock, Shield, ShieldCheck, Key, Phone, Bell,
  // Globe, MapPin, Flag, Tag, Bookmark, Star, Heart, Copy, File, FileText,
  // Camera, Image, Video, Link, Database, Terminal, Hash, Power, Printer,
  // Moon, Sun, Truck, Car, Syringe, Scissors, Receipt, CreditCard, Wallet,
  // Repeat, ThumbsUp, ThumbsDown, Target, Wrench, Scan, Table, Infinity,
  // User, UserPlus, UserCheck, UserMinus, Activity, PlusCircle, MinusCircle,
  // ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowUpRight, Play, Pause,
  // Info, Check, List, Slash, Dog
};

// ── Find files ─────────────────────────────────────────────────────────────────
const raw = execSync(
  `find ${ROOT}/src -name "*.tsx" -o -name "*.ts"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

const files = raw.filter(f =>
  !f.includes('/components/ui/') &&   // Shadcn primitives — leave alone
  !f.includes('node_modules')
);

let changed = 0;
let skipped = 0;

for (const file of files) {
  let src = readFileSync(file, 'utf8');

  const hasLucide =
    src.includes("from 'lucide-react'") ||
    src.includes('from "lucide-react"');

  if (!hasLucide) { skipped++; continue; }

  // ── 1. Parse which icon names are imported from lucide-react ────────────────
  const importedNames = new Set();
  const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]lucide-react['"]/gs;
  let m;
  while ((m = importRegex.exec(src)) !== null) {
    m[1].split(',').forEach(part => {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) importedNames.add(name);
    });
  }

  // ── 2. Replace import source ─────────────────────────────────────────────────
  src = src.replace(
    /from ['"]lucide-react['"]/g,
    "from '@phosphor-icons/react'"
  );

  // ── 3. Rename icon names that differ ─────────────────────────────────────────
  for (const lucideName of importedNames) {
    const phosphorName = MAP[lucideName];
    if (!phosphorName) continue; // Same name in Phosphor — no rename needed
    // Word-boundary replacement so "Users" doesn't mangle "UsersThree"
    const re = new RegExp(`\\b${lucideName}\\b`, 'g');
    src = src.replace(re, phosphorName);
  }

  writeFileSync(file, src);
  changed++;
  console.log(`✓ ${file.replace(ROOT + '/', '')}`);
}

console.log(`\nDone. ${changed} files migrated, ${skipped} skipped (no lucide imports).`);
