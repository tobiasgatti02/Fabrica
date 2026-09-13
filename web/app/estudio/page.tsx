import Studio from '@/components/fabrica/studio';
import { chatGPTSignInPath } from '@/app/chatgpt-auth';
import { getFabricaUser } from '@/app/fabrica-auth';
import './studio.css';
export const dynamic = 'force-dynamic';

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ auth?: string; share?: string }>;
}) {
  const params = await searchParams;
  const auth = params?.auth;
  const sharedToken = params?.share || '';
  const user = await getFabricaUser(undefined, {
    allowChatGPT: auth === 'chatgpt',
  });
  return (
    <Studio
      localPreview={false}
      initialSharedToken={sharedToken}
      user={
        user
          ? {
              name: user.displayName,
              email: user.email,
              provider: user.provider,
            }
          : null
      }
      professionalSignIn={chatGPTSignInPath(
        '/estudio?role=professional&auth=chatgpt',
      )}
    />
  );
}
