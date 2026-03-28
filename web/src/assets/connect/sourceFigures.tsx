import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FaLink, FaRegImage, FaRegPaste } from 'react-icons/fa6';
import { SiImessage, SiTiktok, SiWechat, SiWhatsapp, SiXiaohongshu } from 'react-icons/si';

type SourceKind =
  | 'imessage_demo'
  | 'imessage_photon'
  | 'wechat_export'
  | 'whatsapp_export'
  | 'paste_chat'
  | 'link_note'
  | 'screenshot_caption'
  | 'xhs_favorites'
  | 'tiktok_favorites';

interface FigureConfig {
  Icon: IconType;
  iconClass: string;
  ringClass: string;
}

const FIGURE_CONFIG: Record<SourceKind, FigureConfig> = {
  imessage_demo: { Icon: SiImessage, iconClass: 'text-sky-500', ringClass: 'bg-sky-50 ring-sky-100' },
  imessage_photon: { Icon: SiImessage, iconClass: 'text-violet-600', ringClass: 'bg-violet-50 ring-violet-200' },
  wechat_export: { Icon: SiWechat, iconClass: 'text-emerald-500', ringClass: 'bg-emerald-50 ring-emerald-100' },
  whatsapp_export: { Icon: SiWhatsapp, iconClass: 'text-green-500', ringClass: 'bg-green-50 ring-green-100' },
  paste_chat: { Icon: FaRegPaste, iconClass: 'text-violet-500', ringClass: 'bg-violet-50 ring-violet-100' },
  xhs_favorites: { Icon: SiXiaohongshu, iconClass: 'text-rose-500', ringClass: 'bg-rose-50 ring-rose-100' },
  tiktok_favorites: { Icon: SiTiktok, iconClass: 'text-slate-900', ringClass: 'bg-slate-50 ring-slate-200' },
  link_note: { Icon: FaLink, iconClass: 'text-indigo-500', ringClass: 'bg-indigo-50 ring-indigo-100' },
  screenshot_caption: { Icon: FaRegImage, iconClass: 'text-fuchsia-500', ringClass: 'bg-fuchsia-50 ring-fuchsia-100' },
};

const renderFigure = (kind: SourceKind): ReactNode => {
  const { Icon, iconClass, ringClass } = FIGURE_CONFIG[kind];
  return (
    <div className="relative flex h-24 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-violet-50 to-white">
      <div className="absolute -left-6 top-5 h-16 w-16 rounded-full bg-violet-100/60 blur-sm" />
      <div className="absolute -right-6 bottom-3 h-14 w-14 rounded-full bg-indigo-100/60 blur-sm" />
      <div className={`relative inline-flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset ${ringClass}`}>
        <Icon className={`h-7 w-7 ${iconClass}`} />
      </div>
    </div>
  );
};

export const SOURCE_FIGURES: Record<SourceKind, ReactNode> = {
  imessage_demo: renderFigure('imessage_demo'),
  imessage_photon: renderFigure('imessage_photon'),
  wechat_export: renderFigure('wechat_export'),
  whatsapp_export: renderFigure('whatsapp_export'),
  paste_chat: renderFigure('paste_chat'),
  xhs_favorites: renderFigure('xhs_favorites'),
  tiktok_favorites: renderFigure('tiktok_favorites'),
  link_note: renderFigure('link_note'),
  screenshot_caption: renderFigure('screenshot_caption'),
};
