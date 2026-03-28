import { Link } from 'react-router-dom';
import BentoCard from '@/components/ui/BentoCard';
import StatusBadge from '@/components/ui/StatusBadge';

export default function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-10">
      <BentoCard className="w-full max-w-2xl text-center sm:p-8">
        <div className="mb-3 flex justify-center">
          <StatusBadge tone="violet" className="normal-case tracking-normal text-xs">
            Mirror Memory Copilot
          </StatusBadge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl md:text-6xl">Recall</h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-stone-600 sm:text-lg md:text-xl">
          碎片化知识与灵感的第二大脑 - ingest chats, exports, and links, then structure the noise into
          useful memory.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-8 py-3 text-base font-medium text-white transition hover:bg-violet-700 sm:w-auto"
          >
            Get started
          </Link>
          <Link
            to="/connect"
            className="inline-flex w-full items-center justify-center rounded-xl border border-violet-200 bg-white px-8 py-3 text-base font-medium text-violet-700 transition hover:border-violet-300 hover:text-violet-900 sm:w-auto"
          >
            Explore connect flow
          </Link>
        </div>
      </BentoCard>
    </div>
  );
}
