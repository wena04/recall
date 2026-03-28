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
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard');
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
              className="shrink-0 rounded-full border border-violet-200 bg-white/90 p-1 transition hover:border-violet-300"
              aria-label="Back to homepage"
            >
              <img
                src="/brain-mascot-cutout.png"
                alt="Recall mascot"
                className="h-10 w-10 object-contain"
              />
            </Link>
          }
        />
        <div className="mb-4 mt-4">
          <StatusBadge tone="stone" className="normal-case tracking-normal text-[11px]">
            Google login supported
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
          providers={['google']}
          onlyThirdPartyProviders
          redirectTo={`${window.location.origin}/dashboard`}
        />
      </BentoCard>
    </div>
  );
}
