import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import BentoCard from '@/components/ui/BentoCard';
import SectionHeader from '@/components/ui/SectionHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/connect');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50/80 to-stone-50 px-4 py-10">
      <BentoCard className="w-full max-w-md">
        <SectionHeader
          title="Sign in to Recall"
          description="Continue to your memory dashboard and connect your sources."
          action={
            <Link
              to="/"
              className="shrink-0 rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:text-violet-900"
            >
              Back
            </Link>
          }
        />
        <div className="mb-4 mt-4">
          <StatusBadge tone="stone" className="normal-case tracking-normal text-[11px]">
            Google and GitHub login supported
          </StatusBadge>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#7c3aed',
                  brandAccent: '#6d28d9',
                  inputBackground: '#ffffff',
                  inputText: '#292524',
                },
                radii: {
                  borderRadiusButton: '12px',
                  buttonBorderRadius: '12px',
                  inputBorderRadius: '12px',
                },
              },
            },
          }}
          providers={['google', 'github']}
        />
      </BentoCard>
    </div>
  );
}
